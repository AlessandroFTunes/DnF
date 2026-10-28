import { Application, Assets, Container, FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Grid } from '../grid';
import { blockers, distanceToSegment, visibilityPolygon, type Point } from '../grid/visibility';

/**
 * Renderer da grid com PixiJS. Recebe a `Grid.Scene` (JSON) e desenha; o que o mestre faz no canvas
 * volta como `onChange(scene)`. Não conhece Svelte, PocketBase nem rotas: qualquer app com um
 * elemento HTML consegue usar. Medidas em pixels do mapa; câmera (pan/zoom) é só do renderer.
 *
 * Camadas, de baixo para cima: mapa, grade, desenhos, tokens, escuridão (luz), fog, e (só mestre)
 * paredes e luzes. A visão do jogador (`role: 'player'`) não mostra o que é `hidden`, nem paredes,
 * e cobre fog e escuridão por inteiro (o mestre vê tudo esmaecido).
 */
export type Tool =
  | 'select'
  | 'pen'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'wall'
  | 'door'
  | 'window'
  | 'light'
  | 'token'
  | 'eraser'
  | 'reveal'
  | 'conceal';

export type Selection = { kind: 'token' | 'light' | 'wall' | 'drawing'; id: string };

export interface GridPixiOptions {
  host: HTMLElement;
  role: 'gm' | 'player';
  mapUrl: string;
  scene: Grid.Scene;
  /** Caminho do NAS (token com imagem) -> URL do navegador. */
  resolveUrl?: (path: string) => string;
  onChange?: (scene: Grid.Scene) => void;
  onSelect?: (selection: Selection | null) => void;
  /** Pergunta o texto da ferramenta "texto"; padrão `window.prompt`. */
  askText?: () => string | null | Promise<string | null>;
}

type Dirty = 'grid' | 'drawings' | 'tokens' | 'overlay' | 'fog';

const FOG_MAX_SIDE = 2048;
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

const newId = () => crypto.randomUUID().slice(0, 8);

export class GridPixi {
  private scene: Grid.Scene;
  private tool: Tool = 'select';
  private color = '#ffffff';
  private lineWidth = 4;
  private snap = true;
  private selected: Selection | null = null;
  private destroyed = false;
  private dirty = new Set<Dirty>();
  private frame = 0;

  private readonly world = new Container();
  private readonly gridG = new Graphics();
  private readonly drawingsC = new Container();
  private readonly tokensC = new Container();
  private readonly overlayG = new Graphics();
  private readonly previewG = new Graphics();
  private readonly tokenViews = new Map<string, { view: Container; sig: string }>();

  private readonly fogCanvas = document.createElement('canvas');
  private readonly shadeCanvas = document.createElement('canvas');
  private fogSprite!: Sprite;
  private shadeSprite!: Sprite;
  private fogScale = 1;

  private pan: { startX: number; startY: number; posX: number; posY: number } | null = null;
  private drag:
    | { kind: 'token' | 'light'; id: string; dx: number; dy: number }
    | null = null;
  private draft: { tool: Tool; points: Point[] } | null = null;
  private erasing = false;

  private constructor(
    private readonly app: Application,
    private readonly options: GridPixiOptions,
    private readonly mapSize: { w: number; h: number },
    mapTexture: Texture,
  ) {
    this.scene = options.scene;
    const { w, h } = mapSize;

    const mapSprite = new Sprite(mapTexture);
    mapSprite.width = w;
    mapSprite.height = h;

    this.fogScale = Math.min(1, FOG_MAX_SIDE / Math.max(w, h));
    for (const canvas of [this.fogCanvas, this.shadeCanvas]) {
      canvas.width = Math.max(1, Math.round(w * this.fogScale));
      canvas.height = Math.max(1, Math.round(h * this.fogScale));
    }
    this.fogSprite = new Sprite(Texture.from(this.fogCanvas));
    this.shadeSprite = new Sprite(Texture.from(this.shadeCanvas));
    for (const sprite of [this.fogSprite, this.shadeSprite]) {
      sprite.width = w;
      sprite.height = h;
      sprite.eventMode = 'none';
    }

    this.world.addChild(
      mapSprite,
      this.gridG,
      this.drawingsC,
      this.tokensC,
      this.shadeSprite,
      this.fogSprite,
      this.overlayG,
      this.previewG,
    );
    this.overlayG.eventMode = 'none';
    this.previewG.eventMode = 'none';
    this.drawingsC.eventMode = 'none';
    app.stage.addChild(this.world);

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', this.onDown);
    app.stage.on('pointermove', this.onMove);
    app.stage.on('pointerup', this.onUp);
    app.stage.on('pointerupoutside', this.onUp);
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    app.canvas.addEventListener('contextmenu', this.onContextMenu);

    this.fit();
    this.touch('grid', 'drawings', 'tokens', 'overlay', 'fog');
  }

  static async create(options: GridPixiOptions): Promise<GridPixi> {
    const app = new Application();
    await app.init({
      resizeTo: options.host,
      background: '#0b0b10',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    options.host.appendChild(app.canvas);
    let texture: Texture;
    try {
      texture = await Assets.load<Texture>(options.mapUrl);
    } catch (error) {
      app.destroy(true, { children: true });
      throw error;
    }
    return new GridPixi(app, options, { w: texture.width, h: texture.height }, texture);
  }

  //---------------------------------------------------------------------------------
  // API pública

  getScene(): Grid.Scene {
    return this.scene;
  }

  /** Troca a cena inteira (mestre sincronizando a visão do jogador, ou grade recalibrada). */
  setScene(scene: Grid.Scene) {
    this.scene = scene;
    if (this.selected && !this.exists(this.selected)) this.select(null);
    this.touch('grid', 'drawings', 'tokens', 'overlay', 'fog');
  }

  setTool(tool: Tool) {
    this.tool = tool;
    this.draft = null;
    this.previewG.clear();
    this.app.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  }

  setStyle(style: { color?: string; width?: number }) {
    if (style.color) this.color = style.color;
    if (style.width) this.lineWidth = style.width;
  }

  setSnap(snap: boolean) {
    this.snap = snap;
  }

  select(selection: Selection | null) {
    this.selected = selection;
    this.options.onSelect?.(selection);
    this.touch('tokens', 'overlay');
  }

  /** Altera a cena por fora (calibrar grade, ligar fog/luz…) e redesenha tudo. */
  edit(mutate: (scene: Grid.Scene) => void) {
    mutate(this.scene);
    this.changed('grid', 'drawings', 'tokens', 'overlay', 'fog');
  }

  updateToken(id: string, patch: Partial<Omit<Grid.Token, 'id'>>) {
    const token = this.scene.tokens.find((t) => t.id === id);
    if (!token) return;
    Object.assign(token, patch);
    this.changed('tokens', 'fog');
  }

  updateLight(id: string, patch: Partial<Omit<Grid.Light, 'id'>>) {
    const light = this.scene.lights.find((l) => l.id === id);
    if (!light) return;
    Object.assign(light, patch);
    this.changed('overlay', 'fog');
  }

  removeSelected() {
    const sel = this.selected;
    if (!sel) return;
    this.remove(sel);
    this.select(null);
  }

  /** Apaga as áreas reveladas/escondidas à mão e volta o fog ao começo. */
  resetFog() {
    this.scene.fog.revealed = [];
    this.scene.fog.hidden = [];
    this.changed('fog');
  }

  /** Revela o mapa inteiro. */
  revealAll() {
    const { w, h } = this.mapSize;
    this.scene.fog.revealed = [
      [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
    ];
    this.scene.fog.hidden = [];
    this.changed('fog');
  }

  fit() {
    const { w, h } = this.mapSize;
    const { width, height } = this.app.screen;
    const scale = Math.min(width / w, height / h) * 0.95;
    this.world.scale.set(scale);
    this.world.position.set((width - w * scale) / 2, (height - h * scale) / 2);
  }

  zoomBy(factor: number) {
    const { width, height } = this.app.screen;
    this.zoomAt(factor, width / 2, height / 2);
  }

  get mapWidth() {
    return this.mapSize.w;
  }

  get mapHeight() {
    return this.mapSize.h;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.app.canvas.removeEventListener('wheel', this.onWheel);
    this.app.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.app.destroy(true, { children: true });
  }

  //---------------------------------------------------------------------------------
  // Desenho

  private touch(...parts: Dirty[]) {
    for (const part of parts) this.dirty.add(part);
    if (this.frame || this.destroyed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.paint();
    });
  }

  /** Marca para redesenhar e avisa quem usa que a cena mudou. */
  private changed(...parts: Dirty[]) {
    this.touch(...parts);
    this.options.onChange?.(this.scene);
  }

  private get isGM() {
    return this.options.role === 'gm';
  }

  private paint() {
    if (this.destroyed) return;
    const dirty = this.dirty;
    this.dirty = new Set();
    if (dirty.has('grid')) this.paintGrid();
    if (dirty.has('drawings')) this.paintDrawings();
    if (dirty.has('tokens')) this.paintTokens();
    if (dirty.has('overlay')) this.paintOverlay();
    if (dirty.has('fog')) this.paintFog();
  }

  private paintGrid() {
    const g = this.gridG;
    g.clear();
    const { cell } = this.scene;
    if (!cell.show) return;
    const { w, h } = this.mapSize;
    const startX = ((cell.offsetX % cell.size) + cell.size) % cell.size;
    const startY = ((cell.offsetY % cell.size) + cell.size) % cell.size;
    for (let x = startX; x <= w; x += cell.size) g.moveTo(x, 0).lineTo(x, h);
    for (let y = startY; y <= h; y += cell.size) g.moveTo(0, y).lineTo(w, y);
    g.stroke({ width: 1, color: cell.color, alpha: 0.3 });
  }

  private paintDrawings() {
    for (const child of this.drawingsC.removeChildren()) child.destroy();
    const g = new Graphics();
    this.drawingsC.addChild(g);
    for (const d of this.scene.drawings) {
      if (d.hidden && !this.isGM) continue;
      const alpha = d.hidden ? 0.5 : 1;
      const [p, q] = [d.points[0]!, d.points[d.points.length - 1]!];
      const style = { width: d.width, color: d.color, alpha, cap: 'round', join: 'round' } as const;
      if (d.tool === 'pen') {
        g.moveTo(p[0], p[1]);
        for (const pt of d.points.slice(1)) g.lineTo(pt[0], pt[1]);
        if (d.points.length === 1) g.lineTo(p[0] + 0.01, p[1]);
        g.stroke(style);
      } else if (d.tool === 'line') {
        g.moveTo(p[0], p[1]).lineTo(q[0], q[1]).stroke(style);
      } else if (d.tool === 'rect') {
        g.rect(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])).stroke(style);
      } else if (d.tool === 'ellipse') {
        g.ellipse((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, Math.abs(q[0] - p[0]) / 2, Math.abs(q[1] - p[1]) / 2).stroke(style);
      } else if (d.tool === 'text' && d.text) {
        const label = new Text({
          text: d.text,
          style: { fill: d.color, fontSize: Math.max(16, d.width * 5), fontWeight: 'bold', stroke: { color: '#000', width: 3 } },
        });
        label.position.set(p[0], p[1]);
        label.alpha = alpha;
        this.drawingsC.addChild(label);
      }
    }
  }

  private tokenRadius(token: Grid.Token) {
    return (token.size * this.scene.cell.size) / 2;
  }

  private paintTokens() {
    const seen = new Set<string>();
    for (const token of this.scene.tokens) {
      if (token.hidden && !this.isGM) continue;
      seen.add(token.id);
      const radius = this.tokenRadius(token);
      const selected = this.selected?.kind === 'token' && this.selected.id === token.id;
      const sig = [radius, token.color, token.name, token.hidden, token.image, selected, token.player].join('|');
      let entry = this.tokenViews.get(token.id);
      if (!entry) {
        entry = { view: new Container(), sig: '' };
        entry.view.eventMode = this.isGM ? 'static' : 'none';
        entry.view.cursor = 'grab';
        entry.view.on('pointerdown', (e: FederatedPointerEvent) => this.onTokenDown(token.id, e));
        this.tokensC.addChild(entry.view);
        this.tokenViews.set(token.id, entry);
      }
      if (entry.sig !== sig) {
        entry.sig = sig;
        this.buildTokenView(entry.view, token, radius, selected);
      }
      entry.view.position.set(token.x, token.y);
    }
    for (const [id, entry] of this.tokenViews) {
      if (seen.has(id)) continue;
      entry.view.destroy({ children: true });
      this.tokenViews.delete(id);
    }
  }

  private buildTokenView(view: Container, token: Grid.Token, radius: number, selected: boolean) {
    for (const child of view.removeChildren()) child.destroy();
    const body = new Graphics();
    body.circle(0, 0, radius).fill({ color: token.color, alpha: token.hidden ? 0.45 : 1 });
    body.circle(0, 0, radius).stroke({ width: selected ? 4 : 2, color: selected ? '#f5c542' : token.player ? '#7ee787' : '#000000' });
    view.addChild(body);
    if (token.image) {
      const url = this.options.resolveUrl?.(token.image) ?? token.image;
      Assets.load<Texture>(url).then(
        (texture) => {
          if (this.destroyed || view.destroyed) return;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.width = sprite.height = radius * 2;
          const mask = new Graphics().circle(0, 0, radius).fill(0xffffff);
          view.addChildAt(mask, 1);
          view.addChildAt(sprite, 1);
          sprite.mask = mask;
        },
        () => {},
      );
    } else {
      const initials = new Text({
        text: token.name.slice(0, 2).toUpperCase(),
        style: { fill: '#ffffff', fontSize: Math.max(12, radius * 0.9), fontWeight: 'bold', stroke: { color: '#000', width: 3 } },
      });
      initials.anchor.set(0.5);
      view.addChild(initials);
    }
  }

  /** Paredes, portas, janelas e luzes: só o mestre vê. */
  private paintOverlay() {
    const g = this.overlayG;
    g.clear();
    if (!this.isGM) return;
    for (const wall of this.scene.walls) {
      const sel = this.selected?.kind === 'wall' && this.selected.id === wall.id;
      const color = wall.kind === 'window' ? '#5cc8ff' : wall.kind === 'door' ? (wall.open ? '#6be675' : '#ffb347') : '#ff5c5c';
      g.moveTo(wall.a[0], wall.a[1]).lineTo(wall.b[0], wall.b[1]);
      g.stroke({ width: sel ? 6 : 3, color: sel ? '#f5c542' : color, alpha: wall.kind === 'door' && wall.open ? 0.5 : 1 });
      g.circle(wall.a[0], wall.a[1], 4).circle(wall.b[0], wall.b[1], 4).fill(color);
    }
    const pxPerFoot = this.scene.cell.size / this.scene.cell.feet;
    for (const light of this.scene.lights) {
      const sel = this.selected?.kind === 'light' && this.selected.id === light.id;
      g.circle(light.x, light.y, light.bright * pxPerFoot).fill({ color: light.color, alpha: 0.1 });
      g.circle(light.x, light.y, (light.bright + light.dim) * pxPerFoot).stroke({ width: 1, color: light.color, alpha: 0.5 });
      g.circle(light.x, light.y, 9).fill(light.color).stroke({ width: sel ? 4 : 2, color: sel ? '#f5c542' : '#000000' });
    }
  }

  private paintPreview(a: Point, b: Point, tool: Tool, points?: Point[]) {
    const g = this.previewG;
    g.clear();
    const style = { width: tool === 'reveal' || tool === 'conceal' ? 2 : this.lineWidth, color: this.previewColor(tool), alpha: 0.9, cap: 'round', join: 'round' } as const;
    if (tool === 'pen' && points) {
      g.moveTo(points[0]![0], points[0]![1]);
      for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
      g.stroke(style);
    } else if (tool === 'rect' || tool === 'reveal' || tool === 'conceal') {
      g.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      if (tool !== 'rect') g.fill({ color: style.color, alpha: 0.2 });
      g.stroke(style);
    } else if (tool === 'ellipse') {
      g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2).stroke(style);
    } else {
      g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke(style);
    }
  }

  private previewColor(tool: Tool) {
    if (tool === 'reveal') return '#6be675';
    if (tool === 'conceal') return '#ff5c5c';
    if (tool === 'wall') return '#ff5c5c';
    if (tool === 'door') return '#ffb347';
    if (tool === 'window') return '#5cc8ff';
    return this.color;
  }

  //---------------------------------------------------------------------------------
  // Fog e iluminação (Canvas2D: sobreposição e gradientes são mais simples e firmes que máscaras)

  private feet(ft: number) {
    return (ft / this.scene.cell.feet) * this.scene.cell.size;
  }

  private paintFog() {
    const { fog, lighting } = this.scene;
    const gm = this.isGM;
    this.fogSprite.visible = fog.enabled;
    this.shadeSprite.visible = lighting.enabled;
    this.fogSprite.alpha = this.shadeSprite.alpha = gm ? 0.45 : 1;

    const walls = lighting.enabled || fog.enabled ? blockers(this.scene.walls) : [];
    const viewers = this.scene.tokens.filter((t) => t.player);
    const sources = [
      ...this.scene.lights.map((l) => ({ x: l.x, y: l.y, bright: l.bright, dim: l.dim })),
      ...this.scene.tokens.filter((t) => t.light).map((t) => ({ x: t.x, y: t.y, bright: t.light!.bright, dim: t.light!.dim })),
    ].filter((s) => s.bright + s.dim > 0);
    const lightPolygons = sources.map((s) => ({ ...s, poly: visibilityPolygon([s.x, s.y], this.feet(s.bright + s.dim), walls) }));

    if (lighting.enabled) {
      const ctx = this.begin(this.shadeCanvas);
      ctx.fillStyle = `rgba(0,0,0,${1 - lighting.ambient})`;
      ctx.fillRect(0, 0, this.mapSize.w, this.mapSize.h);
      ctx.globalCompositeOperation = 'destination-out';
      for (const s of lightPolygons) {
        ctx.save();
        this.clipTo(ctx, s.poly);
        this.glow(ctx, s.x, s.y, this.feet(s.bright), this.feet(s.bright + s.dim));
        ctx.restore();
      }
      for (const t of viewers) {
        if (t.vision <= 0) continue;
        ctx.save();
        this.clipTo(ctx, visibilityPolygon([t.x, t.y], this.feet(t.vision), walls));
        this.glow(ctx, t.x, t.y, this.feet(t.vision) * 0.8, this.feet(t.vision));
        ctx.restore();
      }
      this.sourceUpdate(this.shadeSprite);
    }

    if (fog.enabled) {
      const ctx = this.begin(this.fogCanvas);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.mapSize.w, this.mapSize.h);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      for (const poly of fog.revealed) this.fillPoly(ctx, poly);
      if (lighting.enabled) {
        // Dinâmico: o jogador revela o que vê (linha de visão) e que está iluminado ou ao alcance da visão dele.
        for (const t of viewers) {
          const range = t.vision > 0 ? this.feet(t.vision) : 0;
          const sight = visibilityPolygon([t.x, t.y], Math.max(range, ...lightPolygons.map((s) => Math.hypot(s.x - t.x, s.y - t.y) + this.feet(s.bright + s.dim)), 1), walls);
          ctx.save();
          this.clipTo(ctx, sight);
          if (range > 0) this.fillCircle(ctx, t.x, t.y, range);
          for (const s of lightPolygons) {
            ctx.save();
            this.clipTo(ctx, s.poly);
            this.fillCircle(ctx, s.x, s.y, this.feet(s.bright + s.dim));
            ctx.restore();
          }
          ctx.restore();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const poly of fog.hidden) this.fillPoly(ctx, poly);
      this.sourceUpdate(this.fogSprite);
    }
  }

  private begin(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(this.fogScale, 0, 0, this.fogScale, 0, 0);
    return ctx;
  }

  private sourceUpdate(sprite: Sprite) {
    sprite.texture.source.update();
  }

  private polyPath(ctx: CanvasRenderingContext2D, poly: readonly Point[]) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }

  private clipTo(ctx: CanvasRenderingContext2D, poly: readonly Point[]) {
    this.polyPath(ctx, poly);
    ctx.clip();
  }

  private fillPoly(ctx: CanvasRenderingContext2D, poly: readonly Point[]) {
    this.polyPath(ctx, poly);
    ctx.fill();
  }

  private fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Luz cheia até `inner` e esmaecendo até `outer` (apaga a escuridão por baixo). */
  private glow(ctx: CanvasRenderingContext2D, x: number, y: number, inner: number, outer: number) {
    const gradient = ctx.createRadialGradient(x, y, Math.min(inner, outer), x, y, Math.max(outer, 1));
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = gradient;
    this.fillCircle(ctx, x, y, Math.max(outer, 1));
  }

  //---------------------------------------------------------------------------------
  // Mouse

  private local(e: FederatedPointerEvent): Point {
    const p = this.world.toLocal(e.global);
    return [p.x, p.y];
  }

  private snapPoint(p: Point): Point {
    if (!this.snap) return p;
    const { size, offsetX, offsetY } = this.scene.cell;
    return [offsetX + Math.round((p[0] - offsetX) / size) * size, offsetY + Math.round((p[1] - offsetY) / size) * size];
  }

  /** Centro do token alinhado à grade (token de tamanho par encosta nos cantos; ímpar, no meio da célula). */
  private snapToken(p: Point, tokenSize: number): Point {
    if (!this.snap) return p;
    const { size, offsetX, offsetY } = this.scene.cell;
    const half = (tokenSize * size) / 2;
    return [
      offsetX + Math.round((p[0] - half - offsetX) / size) * size + half,
      offsetY + Math.round((p[1] - half - offsetY) / size) * size + half,
    ];
  }

  private onTokenDown = (id: string, e: FederatedPointerEvent) => {
    if (!this.isGM || this.tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    const token = this.scene.tokens.find((t) => t.id === id);
    if (!token) return;
    const p = this.local(e);
    this.drag = { kind: 'token', id, dx: token.x - p[0], dy: token.y - p[1] };
    this.select({ kind: 'token', id });
  };

  private onDown = async (e: FederatedPointerEvent) => {
    const p = this.local(e);
    // Botão do meio/direito, ou a visão do jogador: só move a câmera.
    if (e.button === 1 || e.button === 2 || !this.isGM) {
      this.startPan(e);
      return;
    }
    if (e.button !== 0) return;
    if (this.tool === 'select' && !this.hitTest(p)) {
      this.select(null);
      this.startPan(e);
      return;
    }

    switch (this.tool) {
      case 'select': {
        const hit = this.hitTest(p);
        if (!hit) return;
        this.select(hit);
        if (hit.kind === 'light') {
          const light = this.scene.lights.find((l) => l.id === hit.id)!;
          this.drag = { kind: 'light', id: hit.id, dx: light.x - p[0], dy: light.y - p[1] };
        } else if (hit.kind === 'wall') {
          const wall = this.scene.walls.find((w) => w.id === hit.id);
          if (wall?.kind === 'door') {
            wall.open = !wall.open;
            this.changed('overlay', 'fog');
          }
        }
        return;
      }
      case 'eraser':
        this.erasing = true;
        this.eraseAt(p);
        return;
      case 'token': {
        const n = this.scene.tokens.length + 1;
        const token: Grid.Token = {
          id: newId(),
          name: `Token ${n}`,
          x: 0,
          y: 0,
          size: 1,
          color: this.color === '#ffffff' ? '#d94f4f' : this.color,
          image: null,
          hidden: false,
          player: false,
          vision: 0,
          light: null,
        };
        [token.x, token.y] = this.snapToken(p, 1);
        this.scene.tokens.push(token);
        this.changed('tokens', 'fog');
        this.select({ kind: 'token', id: token.id });
        return;
      }
      case 'light': {
        const light: Grid.Light = { id: newId(), x: p[0], y: p[1], bright: 20, dim: 20, color: '#ffd9a0' };
        this.scene.lights.push(light);
        this.changed('overlay', 'fog');
        this.select({ kind: 'light', id: light.id });
        return;
      }
      case 'text': {
        const text = (await (this.options.askText?.() ?? window.prompt('Texto'))) ?? '';
        if (!text.trim()) return;
        this.scene.drawings.push({ id: newId(), tool: 'text', points: [p], color: this.color, width: this.lineWidth, text: text.trim(), hidden: false });
        this.changed('drawings');
        return;
      }
      case 'wall':
      case 'door':
      case 'window': {
        const start = this.snapPoint(p);
        this.draft = { tool: this.tool, points: [start, start] };
        return;
      }
      default:
        this.draft = { tool: this.tool, points: [p, p] };
    }
  };

  private startPan(e: FederatedPointerEvent) {
    this.pan = { startX: e.global.x, startY: e.global.y, posX: this.world.x, posY: this.world.y };
  }

  private onMove = (e: FederatedPointerEvent) => {
    if (this.pan) {
      this.world.position.set(this.pan.posX + e.global.x - this.pan.startX, this.pan.posY + e.global.y - this.pan.startY);
      return;
    }
    const p = this.local(e);
    if (this.drag) {
      if (this.drag.kind === 'token') {
        const token = this.scene.tokens.find((t) => t.id === this.drag!.id);
        if (!token) return;
        [token.x, token.y] = this.snapToken([p[0] + this.drag.dx, p[1] + this.drag.dy], token.size);
        this.touch('tokens', 'fog');
      } else {
        const light = this.scene.lights.find((l) => l.id === this.drag!.id);
        if (!light) return;
        [light.x, light.y] = [p[0] + this.drag.dx, p[1] + this.drag.dy];
        this.touch('overlay', 'fog');
      }
      return;
    }
    if (this.erasing) {
      this.eraseAt(p);
      return;
    }
    const draft = this.draft;
    if (!draft) return;
    const current = draft.tool === 'wall' || draft.tool === 'door' || draft.tool === 'window' ? this.snapPoint(p) : p;
    if (draft.tool === 'pen') draft.points.push(current);
    else draft.points[1] = current;
    this.paintPreview(draft.points[0]!, current, draft.tool, draft.points);
  };

  private onUp = () => {
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (this.drag) {
      this.drag = null;
      this.options.onChange?.(this.scene);
      return;
    }
    if (this.erasing) {
      this.erasing = false;
      return;
    }
    const draft = this.draft;
    if (!draft) return;
    this.draft = null;
    this.previewG.clear();
    const a = draft.points[0]!;
    const b = draft.points[draft.points.length - 1]!;
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]) > 4;
    const { fog } = this.scene;
    switch (draft.tool) {
      case 'wall':
      case 'door':
      case 'window':
        if (!long) return;
        this.scene.walls.push({ id: newId(), a, b, kind: draft.tool === 'wall' ? 'wall' : draft.tool, open: false });
        this.changed('overlay', 'fog');
        return;
      case 'reveal':
      case 'conceal': {
        if (!long) return;
        const rect: Point[] = [a, [b[0], a[1]], b, [a[0], b[1]]];
        (draft.tool === 'reveal' ? fog.revealed : fog.hidden).push(rect);
        fog.enabled = true;
        this.changed('fog');
        return;
      }
      case 'pen':
      case 'line':
      case 'rect':
      case 'ellipse': {
        if (draft.tool !== 'pen' && !long) return;
        const points = draft.tool === 'pen' ? simplify(draft.points) : [a, b];
        this.scene.drawings.push({ id: newId(), tool: draft.tool, points, color: this.color, width: this.lineWidth, hidden: false });
        this.changed('drawings');
        return;
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
  };

  private onContextMenu = (e: Event) => e.preventDefault();

  private zoomAt(factor: number, x: number, y: number) {
    const old = this.world.scale.x;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, old * factor));
    const ratio = next / old;
    this.world.position.set(x - (x - this.world.x) * ratio, y - (y - this.world.y) * ratio);
    this.world.scale.set(next);
  }

  //---------------------------------------------------------------------------------
  // Acerto e remoção

  private exists(sel: Selection) {
    const list = { token: this.scene.tokens, light: this.scene.lights, wall: this.scene.walls, drawing: this.scene.drawings }[sel.kind];
    return list.some((item) => item.id === sel.id);
  }

  private remove(sel: Selection) {
    const s = this.scene;
    if (sel.kind === 'token') s.tokens = s.tokens.filter((i) => i.id !== sel.id);
    else if (sel.kind === 'light') s.lights = s.lights.filter((i) => i.id !== sel.id);
    else if (sel.kind === 'wall') s.walls = s.walls.filter((i) => i.id !== sel.id);
    else s.drawings = s.drawings.filter((i) => i.id !== sel.id);
    this.changed('tokens', 'overlay', 'drawings', 'fog');
  }

  private eraseAt(p: Point) {
    const hit = this.hitTest(p);
    if (hit) this.remove(hit);
  }

  /** O que está sob o ponto: token, luz, parede ou desenho, nessa ordem. */
  hitTest(p: Point): Selection | null {
    const tol = 10 / this.world.scale.x;
    for (const token of [...this.scene.tokens].reverse()) {
      if (Math.hypot(p[0] - token.x, p[1] - token.y) <= this.tokenRadius(token)) return { kind: 'token', id: token.id };
    }
    for (const light of this.scene.lights) {
      if (Math.hypot(p[0] - light.x, p[1] - light.y) <= 12 / this.world.scale.x + 4) return { kind: 'light', id: light.id };
    }
    for (const wall of this.scene.walls) {
      if (distanceToSegment(p, wall) <= tol) return { kind: 'wall', id: wall.id };
    }
    for (const d of [...this.scene.drawings].reverse()) {
      if (d.hidden && !this.isGM) continue;
      if (hitsDrawing(p, d, tol)) return { kind: 'drawing', id: d.id };
    }
    return null;
  }
}

/** Tira pontos quase iguais do traço da caneta (menos JSON e desenho igual). */
function simplify(points: Point[], min = 2): Point[] {
  const out: Point[] = [points[0]!];
  for (const p of points.slice(1)) {
    const last = out[out.length - 1]!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= min) out.push(p);
  }
  const end = points[points.length - 1]!;
  if (out[out.length - 1] !== end) out.push(end);
  return out.slice(0, 5000);
}

function hitsDrawing(p: Point, d: Grid.Drawing, tol: number): boolean {
  const reach = tol + d.width / 2;
  const first = d.points[0]!;
  const last = d.points[d.points.length - 1]!;
  switch (d.tool) {
    case 'pen':
    case 'line': {
      if (d.points.length === 1) return Math.hypot(p[0] - first[0], p[1] - first[1]) <= reach;
      for (let i = 1; i < d.points.length; i++) {
        if (distanceToSegment(p, { a: d.points[i - 1]!, b: d.points[i]! }) <= reach) return true;
      }
      return false;
    }
    case 'rect': {
      const [x1, x2] = [Math.min(first[0], last[0]), Math.max(first[0], last[0])];
      const [y1, y2] = [Math.min(first[1], last[1]), Math.max(first[1], last[1])];
      const edges: [Point, Point][] = [
        [[x1, y1], [x2, y1]],
        [[x2, y1], [x2, y2]],
        [[x2, y2], [x1, y2]],
        [[x1, y2], [x1, y1]],
      ];
      return edges.some(([a, b]) => distanceToSegment(p, { a, b }) <= reach);
    }
    case 'ellipse': {
      const rx = Math.abs(last[0] - first[0]) / 2 || 1;
      const ry = Math.abs(last[1] - first[1]) / 2 || 1;
      const nx = (p[0] - (first[0] + last[0]) / 2) / rx;
      const ny = (p[1] - (first[1] + last[1]) / 2) / ry;
      return Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry) <= reach;
    }
    case 'text': {
      const size = Math.max(16, d.width * 5);
      const width = (d.text?.length ?? 1) * size * 0.6;
      return p[0] >= first[0] && p[0] <= first[0] + width && p[1] >= first[1] && p[1] <= first[1] + size * 1.3;
    }
  }
}

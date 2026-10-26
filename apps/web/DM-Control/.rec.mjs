import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/home/Ale/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome' });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: '/tmp/claude-1000/-home-Ale-projects-DnF-apps-web/84dba5df-daa7-4074-b9fd-20a864d07dfd/scratchpad/state.json', recordVideo: { dir: '/tmp/claude-1000/-home-Ale-projects-DnF-apps-web/84dba5df-daa7-4074-b9fd-20a864d07dfd/scratchpad/vid', size: { width: 390, height: 844 } } });
await c.close();

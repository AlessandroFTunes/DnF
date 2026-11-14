{
  description = "DnF: ambiente de desenvolvimento (app Expo, core PocketBase, deploy no NAS)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            bun
            nodejs_22
            git
            gh
            # CLI do Docker; o daemon é o do sistema (docker.socket)
            docker-client
            docker-compose
            # deploy no NAS (ssh/scp, scripts/deploy.sh)
            openssh
            rsync
            jq
            curl
            watchman
          ];

          shellHook = ''
            export EXPO_NO_TELEMETRY=1
          '';
        };
      });
}

{
  description = "Pickleball tournaments with an optional Zoezi connection";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-linux" "x86_64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          frontend = pkgs.buildNpmPackage {
            pname = "pickleball-frontend";
            version = "0.1.0";
            src = ./frontend;
            nodejs = pkgs.nodejs_24;
            npmDepsHash = "sha256-+GDzF2jR7boFPvzT1pG5exWAE8H07j6CZBGIwvwEfVE=";
            doCheck = true;
            checkPhase = ''
              runHook preCheck
              npm run check
              npm test
              runHook postCheck
            '';
            installPhase = ''
              mkdir -p $out
              cp -r build/. $out/
            '';
          };
          package = pkgs.rustPlatform.buildRustPackage {
            pname = "pickleball";
            version = "0.1.0";
            src = pkgs.lib.cleanSource self;
            cargoLock.lockFile = ./Cargo.lock;
            preBuild = ''
              mkdir -p frontend/build
              cp -r ${frontend}/. frontend/build/
            '';
            meta.mainProgram = "americano";
          };
        in {
          default = package;
          inherit frontend;
        });

      nixosModules.default = { config, lib, pkgs, ... }:
        let cfg = config.services.pickleball;
        in {
          options.services.pickleball = {
            enable = lib.mkEnableOption "the Pickleball tournament app";
            port = lib.mkOption { type = lib.types.port; default = 29393; };
            zoezi = {
              enable = lib.mkEnableOption "Zoezi member login and participant import";
              publicOrigin = lib.mkOption {
                type = lib.types.str;
                default = "";
                description = "Public HTTPS origin, without a trailing slash.";
              };
            };
          };
          config = lib.mkIf cfg.enable {
            assertions = [{
              assertion = !cfg.zoezi.enable || builtins.match "https://[^/]+" cfg.zoezi.publicOrigin != null;
              message = "Pickleball's Zoezi connection requires an HTTPS publicOrigin without a trailing slash.";
            }];
            systemd.services.pickleball = {
              description = "Pickleball tournament app";
              wantedBy = [ "multi-user.target" ];
              after = [ "network-online.target" ];
              wants = [ "network-online.target" ];
              environment = {
                HOST = "127.0.0.1";
                PORT = toString cfg.port;
                ZOEZI_ENABLED = lib.boolToString cfg.zoezi.enable;
                ZOEZI_PUBLIC_ORIGIN = cfg.zoezi.publicOrigin;
              };
              serviceConfig = {
                ExecStart = "${self.packages.${pkgs.stdenv.hostPlatform.system}.default}/bin/americano";
                DynamicUser = true;
                Restart = "on-failure";
                RestartSec = 5;
                UMask = "0077";
                LimitCORE = 0;
                NoNewPrivileges = true;
                PrivateTmp = true;
                PrivateDevices = true;
                ProtectSystem = "strict";
                ProtectHome = true;
                ProtectKernelTunables = true;
                ProtectKernelModules = true;
                ProtectControlGroups = true;
                RestrictSUIDSGID = true;
                RestrictAddressFamilies = [ "AF_INET" "AF_INET6" "AF_UNIX" ];
                CapabilityBoundingSet = "";
              };
            };
          };
        };
    };
}

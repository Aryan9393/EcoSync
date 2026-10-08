# Workspace config for existing Firebase Studio workspaces (Gemini in Firebase).
{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [ pkgs.nodejs_22 ];
  env = { };
  idx = {
    extensions = [ ];
    workspace = {
      onCreate = { npm-install = "npm ci"; };
    };
    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "node" "server.js" ];
          env = { PORT = "$PORT"; };
          manager = "web";
        };
      };
    };
  };
}

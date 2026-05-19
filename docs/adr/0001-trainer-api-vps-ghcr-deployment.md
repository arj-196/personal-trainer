# Trainer API VPS GHCR Deployment

The web app deploys through Vercel, while the Trainer API deploys to a VPS from GitHub Actions. The workflow builds a production Docker image, publishes it privately to GitHub Container Registry, SSHes into the VPS, runs migrations before restart, and updates the Docker Compose service by commit SHA. This keeps the VPS free of build tooling, gives each deploy a reproducible artifact, supports rollback to a known commit image, and keeps the Trainer API lifecycle separate from Vercel.

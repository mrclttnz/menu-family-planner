#!/usr/bin/env bash
# ==============================================================================
# Helper Script: Build and Push Menu Design image to Docker Hub
#
# Usage:
#   ./scripts/build_and_push_dockerhub.sh <your-dockerhub-username> [tag]
#
# Examples:
#   ./scripts/build_and_push_dockerhub.sh myuser
#   ./scripts/build_and_push_dockerhub.sh myuser v1.0.0
# ==============================================================================

set -euo pipefail

DOCKERHUB_USER="${1:-}"
TAG="${2:-latest}"

if [[ -z "$DOCKERHUB_USER" ]]; then
  echo "❌ Error: Docker Hub username is required."
  echo "Usage: $0 <your-dockerhub-username> [tag]"
  echo "Example: $0 myuser v1.0.0"
  exit 1
fi

IMAGE_NAME="${DOCKERHUB_USER}/menu-design-app:${TAG}"

echo "=========================================================="
echo " Building & Pushing Menu Design to Docker Hub"
echo " Image: $IMAGE_NAME"
echo "=========================================================="

# Check if logged in to Docker Hub
echo "Verifying Docker Hub login..."
docker info | grep -q "Username" || {
  echo "ℹ️  Please ensure you are logged into Docker Hub: 'docker login'"
}

# Determine build platform (QNAP NAS is usually linux/amd64 or linux/arm64)
# If buildx is available, build multi-arch or target arch:
PLATFORM="${BUILD_PLATFORM:-linux/amd64,linux/arm64}"

echo "Building multi-architecture image for: $PLATFORM"
if docker buildx version &>/dev/null; then
  # Ensure a buildx builder exists and is running
  docker buildx inspect menu-builder &>/dev/null || docker buildx create --name menu-builder --use
  docker buildx use menu-builder
  docker buildx build \
    --platform "$PLATFORM" \
    --tag "$IMAGE_NAME" \
    --push \
    .
else
  echo "⚠️ buildx not found. Falling back to standard docker build..."
  docker build -t "$IMAGE_NAME" .
  docker push "$IMAGE_NAME"
fi

echo "=========================================================="
echo "✅ Successfully built and pushed: $IMAGE_NAME"
echo "=========================================================="
echo "On your QNAP, set in .env.production:"
echo "APP_IMAGE=$IMAGE_NAME"

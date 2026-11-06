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
  # Ensure a healthy buildx builder exists, auto-recovering from stale WSL bind mounts
  if docker buildx inspect menu-builder &>/dev/null; then
    if ! docker buildx inspect --bootstrap menu-builder &>/dev/null; then
      echo "⚠️ Detected stale menu-builder container. Recreating builder..."
      docker buildx rm menu-builder 2>/dev/null || true
      docker rm -f buildx_buildkit_menu-builder0 2>/dev/null || true
      docker buildx create --name menu-builder --use
    fi
  else
    docker buildx create --name menu-builder --use
  fi
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

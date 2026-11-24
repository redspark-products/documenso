#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AWS_REGION="sa-east-1"
AWS_ACCOUNT_ID="096313777391"
ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE_NAME="bridge/documenso"
SOURCE_CODE_URL="https://github.com/redspark-products/documenso"

# ECS runs x86_64. A native build on Apple Silicon would produce an arm64 image that
# fails to start there with "exec format error", so the platform is pinned by default.
PLATFORM="${PLATFORM:-linux/amd64}"

usage() {
  cat <<EOF
Uso:
  docker/build_holmes.sh build [-t <tag>]
  docker/build_holmes.sh release -p <aws-profile> [-t <tag>]

Comandos:
  build     Gera a imagem local $IMAGE_NAME:<tag>.
  release   Gera a imagem e envia para $ECR_REGISTRY/$IMAGE_NAME:<tag>.

Opções:
  -p <profile>  Profile da AWS CLI (obrigatório no release).
  -t <tag>      Tag da imagem. Sem ela, o script pergunta; Enter usa "latest".
  -h            Mostra esta ajuda.

Variáveis:
  PLATFORM      Plataforma da imagem (padrão: linux/amd64).
EOF
}

fail() {
  echo "Erro: $*" >&2
  exit 1
}

ask_tag() {
  if [ -n "$TAG" ]; then
    return
  fi

  if [ -t 0 ]; then
    read -r -p "Tag da imagem [latest]: " TAG
  fi

  TAG="${TAG:-latest}"
}

assert_valid_tag() {
  if ! [[ "$TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
    fail "tag inválida: '$TAG'. Use letras, números, '_', '.' ou '-' (até 128 caracteres)."
  fi
}

assert_docker_running() {
  docker info >/dev/null 2>&1 || fail "o Docker não está rodando. Inicie o Docker e tente de novo."
}

# Checked before the build so a wrong profile fails in seconds, not after a long build.
assert_aws_account() {
  command -v aws >/dev/null 2>&1 || fail "AWS CLI não encontrada."

  local account_id
  account_id="$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)" ||
    fail "não foi possível autenticar com o profile '$AWS_PROFILE'. Se usa SSO, rode: aws sso login --profile $AWS_PROFILE"

  if [ "$account_id" != "$AWS_ACCOUNT_ID" ]; then
    fail "o profile '$AWS_PROFILE' aponta para a conta $account_id, mas o ECR está na conta $AWS_ACCOUNT_ID."
  fi
}

build_image() {
  local git_sha
  git_sha="$(git -C "$MONOREPO_ROOT" rev-parse HEAD)"

  if [ -n "$(git -C "$MONOREPO_ROOT" status --porcelain)" ]; then
    echo "Aviso: há mudanças não commitadas. Elas entram na imagem, mas não no commit $git_sha indicado no label." >&2
  fi

  echo "Gerando $IMAGE_NAME:$TAG ($PLATFORM) a partir de $git_sha"

  docker build -f "$SCRIPT_DIR/Dockerfile" \
    --platform "$PLATFORM" \
    --progress=plain \
    --build-arg NEXT_PRIVATE_TELEMETRY_KEY="${NEXT_PRIVATE_TELEMETRY_KEY:-}" \
    --build-arg NEXT_PRIVATE_TELEMETRY_HOST="${NEXT_PRIVATE_TELEMETRY_HOST:-}" \
    --label "org.opencontainers.image.revision=$git_sha" \
    --label "org.opencontainers.image.source=$SOURCE_CODE_URL" \
    -t "$IMAGE_NAME:$TAG" \
    "$MONOREPO_ROOT"
}

push_image() {
  local remote_image="$ECR_REGISTRY/$IMAGE_NAME:$TAG"

  aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" |
    docker login --username AWS --password-stdin "$ECR_REGISTRY"

  docker tag "$IMAGE_NAME:$TAG" "$remote_image"
  docker push "$remote_image"

  echo "Publicado: $remote_image"
}

COMMAND="${1:-}"

if [ -z "$COMMAND" ] || [ "$COMMAND" = "-h" ] || [ "$COMMAND" = "--help" ]; then
  usage
  exit 0
fi

shift

AWS_PROFILE=""
TAG=""

while getopts ":p:t:h" opt; do
  case "$opt" in
    p) AWS_PROFILE="$OPTARG" ;;
    t) TAG="$OPTARG" ;;
    h)
      usage
      exit 0
      ;;
    :) fail "a opção -$OPTARG precisa de um valor." ;;
    *) fail "opção desconhecida: -$OPTARG. Use -h para ver a ajuda." ;;
  esac
done

case "$COMMAND" in
  build)
    assert_docker_running
    ask_tag
    assert_valid_tag
    build_image
    echo "Imagem local: $IMAGE_NAME:$TAG"
    ;;
  release)
    [ -n "$AWS_PROFILE" ] || fail "o release precisa do profile da AWS: -p <profile>."
    assert_docker_running
    ask_tag
    assert_valid_tag
    assert_aws_account
    build_image
    push_image
    ;;
  *)
    usage >&2
    fail "comando desconhecido: '$COMMAND'. Use build ou release."
    ;;
esac

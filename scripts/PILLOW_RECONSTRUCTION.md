# 베개 사진 기반 3D 복원 재현

실측 스캔이 아닙니다. A~E 원본 사진 45장으로 추정한 카메라와 희소 특징점의 표면을 사용합니다. 끝 구멍·밑면·안쪽은 일부 형상을 보정했으며, 밑면 F01은 카메라가 복원되지 않아 수동으로 맞춘 투영입니다. TV 참고 영상의 이미지·무늬는 사용하지 않습니다.

`pillow-reconstruction-inputs.zip`에는 원본 COLMAP 좌표의 잘린 메시, 복원된 카메라, PCA·절단 설정, 원본 사진 출처 해시 및 경계 배경 혼입 방지 마스크가 있습니다. 원본 JPEG 54장은 기존 저장소의 `public/models/celadon-pillow`에 있습니다. 마스크는 텍스처 좌표를 실제 도자기 안쪽으로 제한하며 원본 사진을 수정하지 않습니다.

Blender 4.3+와 함께 제공되는 NumPy를 사용합니다. 아래 경로는 임의의 로컬 경로로 바꿀 수 있습니다.

```sh
unzip scripts/data/pillow-reconstruction-inputs.zip -d /tmp/pillow-reconstruction-inputs

blender -b --python scripts/build_pillow_reconstruction.py -- \
  --reconstruction /tmp/pillow-reconstruction-inputs \
  --photos public/models/celadon-pillow \
  --mesh /tmp/pillow-reconstruction-inputs/actual-poisson-trimmed.ply \
  --output /tmp/pillow-baked.glb

blender -b --python scripts/finish_pillow_reconstruction.py -- \
  --input /tmp/pillow-baked.glb \
  --metrics /tmp/pillow-baked-metrics.json \
  --trim-metadata /tmp/pillow-reconstruction-inputs/trim-metadata.json \
  --under-photo public/models/celadon-pillow/F01.jpg \
  --output public/models/celadon-pillow-reconstruction.glb
```

첫 단계는 사진 투영과 4K 아틀라스 생성이며, 두 번째 단계는 극소 면 정리, 추정 밑면의 매끄러운 법선 및 원본 F01의 별도 투영입니다. 두 단계 모두 원본 사진을 그대로 읽습니다. 원본 사진의 내용이 변경되면 첫 단계에서 중단합니다.

완성된 모델은 4K 아틀라스와 원본 F01 JPEG를 파일 안에 포함합니다. 별도 뷰어·외부 이미지 서버는 필요하지 않습니다. 부정확할 수 있는 무늬 위치·형상은 반드시 원본 다각도 사진으로 함께 확인해야 합니다.

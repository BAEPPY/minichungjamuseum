# 모란무늬 매병의 연속 회전용 3D 재현

국립중앙박물관 신안11590 **청자 음인각 모란무늬 매병**의 원본 다각도 사진을 사용한 근사 모델입니다. 공식 실측 메시가 아니며, 사진 사이의 각도에서도 끊김 없이 돌려 볼 수 있도록 만들었습니다. 세부 관찰의 기준은 함께 보관된 원본 사진 54장입니다.

## 재현 방법과 범위

- 원본 `public/models/japan-peony`의 JPEG 54장은 수정하거나 다시 압축하지 않았습니다. 빌드 시작 시 기존 출처 목록의 SHA-256과 모두 대조합니다.
- 행 0–4의 사진 45장에서 카메라와 희소 특징점 20,112개를 복원했습니다. 평균 재투영 오차는 0.442픽셀입니다. 이 중 18,965개를 추려 매끄러운 높이별 단면과 작은 비대칭을 맞췄습니다. 이는 형상의 실측 정확도를 뜻하지 않습니다.
- 몸통의 모란무늬와 색 변화는 복원된 카메라로 원본 사진을 투영해 얻었습니다. 앞을 향하는 사진에 더 높은 가중치를 주며, 배경 마스크는 흰 배경이 묻어나는 것을 줄이는 용도로만 사용합니다. 새로운 문양을 그려 넣지 않습니다.
- 입구는 실제로 열려 있습니다. 입술의 높낮이는 사진의 특징점에 맞췄지만, 파손부 깊이·벽 두께·안쪽 형상은 근사입니다. 보이지 않는 안쪽에는 무늬 없이 어두운 도자기색을 사용합니다.
- 뒤집어 촬영한 행 5의 사진 9장은 위쪽 사진들과 카메라가 연결되지 않았습니다. 밑면은 원본 `5_4.jpg`의 실제 굽 원판을 수동으로 맞춰 투영했습니다. 중심은 `(699, 979)`, 반지름은 가로 276·세로 292픽셀입니다. 밑면 형상과 방향 정합은 추정입니다.
- 원본 조명과 반사광이 이미 사진에 있으므로 `KHR_materials_unlit`로 표시합니다. 추가 조명으로 색이 변하거나 하이라이트가 중복되는 것을 피하지만, 실제 유약의 광학 특성을 측정한 재질은 아닙니다. 앱에서는 이 모델의 사진 재질에 추가 톤 매핑을 적용하지 않아 원본의 색이 다시 밝아지는 것을 피합니다.

사진에 보이는 음각은 주로 텍스처입니다. 홈의 깊이, 입술의 세부 파손, 안쪽·굽 형상을 정확하게 재현한 모델로 사용하면 안 됩니다. 물리적 크기는 복원하지 않았으며, 수치 측정이나 복제품 제작용이 아닙니다.

## 저장된 입력

`scripts/data/peony-reconstruction-inputs.zip`에는 다음을 담았습니다.

- `recovered-cameras.json`: 사진 45장의 카메라 위치·회전·내부 파라미터
- `fitted-profile.json`: 단면, 비대칭, 입술 높이와 좌표 변환
- `precise-masks/`: 복원 사진 45장과 별도 밑면 사진 1장의 배경 마스크
- `recovery-summary.json`: 복원 방법과 오차·추정 범위
- `input-manifest.json`: 위 입력 파일의 크기와 SHA-256

원본 사진은 기존 저장소에 있으므로 압축 파일에 중복해서 넣지 않았습니다. COLMAP 데이터베이스·캐시·렌더 이미지는 필요하지 않습니다. 복원된 카메라와 단면을 입력으로 고정했으므로 아래 재빌드에는 COLMAP이나 Blender도 필요하지 않습니다.

## 재빌드

Python과 NumPy, SciPy, OpenCV, Pillow가 필요합니다. 검증 환경은 NumPy 2.5.4, SciPy 1.18.1, OpenCV 5.0.0, Pillow 13.0.0입니다. 라이브러리·JPEG 인코더 버전이 달라지면 출력 파일의 해시가 달라질 수 있습니다.

저장소 루트에서 실행합니다. 아래 `/tmp` 경로는 다른 작업 폴더로 바꿔도 됩니다.

```sh
python -m venv /tmp/peony-build-env
/tmp/peony-build-env/bin/pip install numpy scipy opencv-python-headless Pillow

unzip scripts/data/peony-reconstruction-inputs.zip -d /tmp/peony-reconstruction-inputs

OPENBLAS_NUM_THREADS=2 /tmp/peony-build-env/bin/python scripts/build_peony_reconstruction.py \
  --inputs /tmp/peony-reconstruction-inputs \
  --photos public/models/japan-peony \
  --texture-width 4096 \
  --texture-height 3072 \
  --output /tmp/japan-peony-reconstruction.glb
```

빌드는 GLB 옆에 검사용 `.atlas.jpg`, `.metrics.json`, `.mesh.npz`도 만듭니다. 앱에서 필요한 파일은 **GLB 하나**입니다. 결과를 확인한 뒤 이 파일만 `public/models/japan-peony-reconstruction.glb`에 복사하고, 모델이 변경되었다면 출처 JSON의 해시·크기·검증 정보도 갱신합니다.

## 현재 산출물과 검증

- GLB: 7,356,700바이트, 정점 65,813개, 삼각형 129,792개
- 4096×3072 JPEG 아틀라스 포함, 외부 버퍼·이미지 요청 없음
- Draco·KTX 별도 디코더 불필요, Y축 위쪽
- SHA-256: `4d8d63367411f6a1cca4cf51c58140d98f11244943f8e5f5e670b29b2bb3010f`
- 위치·법선·UV 유한값, 법선 단위 길이, 모든 삼각형 면적 양수
- UV 경계와 중심축의 겹치는 정점을 합친 뒤 열린 경계 0개, 비다양체 모서리 0개
- 정면·사선·반대편·위·아래 렌더를 원본 사진과 대조했습니다.
- 저장한 입력 압축 파일을 새 폴더에 풀어 전체 4K 빌드를 다시 실행했고, 승인된 GLB와 바이트 단위로 같은 결과를 확인했습니다.

열린 경계가 없다는 것은 입구가 막혔다는 뜻이 아닙니다. 바깥면에서 입술을 거쳐 안쪽 벽·안쪽 바닥으로 이어지는 도자기 벽을 닫힌 표면으로 구성했습니다.

공식 출처와 원본별 해시는 `public/models/japan-peony/source-provenance.json`, 복원 방법과 한계·출력 해시는 `public/models/japan-peony-reconstruction-source.json`에 있습니다. 원본 사진의 이용 조건은 국립중앙박물관 안내를 따릅니다.

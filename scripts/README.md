# Scripts Overview

- `extract_texture_filename_from_3ds.py`: Parses a `.3ds` binary and lists referenced texture filenames.
- `generate_3d_glb.py`: For each PNG in `images/`, calls the `tencent/hunyuan3d-2` model via `synexa`, downloads `textured_mesh.glb`, and saves it locally.
- `generate_json.py`: Loads `wesen.json`, fuzzy-maps names to a hardcoded model list, and writes `spirit_list_out.json` with `Model URL` fields (German console messages).
- `image_from_json.py`: For each entry in a JSON list, asks an OpenAI chat model for an image prompt, then calls the Image API to generate/download images (configurable CLI).
- `naming.py`: Matches `.webp` images in `webp/` to entries in `spirit_list.json` (or their model filenames), adds `Image URL` fields, and writes `spirit_list_with_images.json`.
- `openai_image_gen.py`: Simple CLI wrapper around the OpenAI Image API to generate and download images from a prompt.
- `remesh_bake_batch.py`: Blender automation: imports a GLB, QuadRemesher remeshes it, auto-UVs, bakes diffuse/normal maps, exports a remeshed GLB plus PNG bake outputs.

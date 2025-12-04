import os
import requests
import synexa

# Configuration
INPUT_DIR = "images"  # local folder with your .png files
BASE_URL = "https://www.victorgiers.com/shinto"  # where the images live
MODEL_NAME = "tencent/hunyuan3d-2"
TIMEOUT = 180  # seconds

def process_image_file(filename: str):
    # 1. Build the full URL for the input image
    base_name, ext = os.path.splitext(filename)
    if ext.lower() != ".png":
        return  # skip non-png files
    
    image_url = f"{BASE_URL}/{filename}"
    output_filename = f"{base_name}.glb"

    print(f"\n→ Processing {filename}…")
    # 2. Run the model with extended timeout
    try:
        response_list = synexa.run(
            MODEL_NAME,
            input={
                "seed": 1234,
                "image": image_url,
                "steps": 5,
                "caption": "",
                "shape_only": False,
                "guidance_scale": 5.5,
                "multiple_views": [],
                "check_box_rembg": True,
                "octree_resolution": "256"
            },
            wait=TIMEOUT
        )
    except Exception as e:
        print(f"  ⚠️  Model run failed for {filename}: {e}")
        return

    # 3. Find the textured_mesh.glb URL
    textured_url = None
    for fo in response_list:
        url = getattr(fo, "url", "")
        if url.endswith("textured_mesh.glb"):
            textured_url = url
            break

    if not textured_url:
        print(f"  ⚠️  No textured_mesh.glb found in response for {filename}")
        return

    # 4. Download and save
    print(f"  ↓ Downloading textured mesh → {output_filename}")
    try:
        dl = requests.get(textured_url, timeout=TIMEOUT)
        dl.raise_for_status()
        with open(output_filename, "wb") as out_file:
            out_file.write(dl.content)
        print(f"  ✅ Saved {output_filename}")
    except Exception as e:
        print(f"  ⚠️  Download failed for {filename}: {e}")

def main():
    # Ensure we're in the right directory (or adjust INPUT_DIR to full path)
    for fname in os.listdir(INPUT_DIR):
        process_image_file(fname)

if __name__ == "__main__":
    main()
import struct
import sys


def extract_3ds_texture_paths(three_ds_path):
    """
    Reads a .3ds file and returns a list of referenced texture filenames.

    Args:
        three_ds_path (str): Path to the .3ds file.

    Returns:
        List[str]: Texture filenames referenced in the .3ds file.
    """
    paths = []
    with open(three_ds_path, 'rb') as f:
        while True:
            header = f.read(6)
            if len(header) < 6:
                break
            chunk_id, chunk_len = struct.unpack('<HI', header)
            data_len = chunk_len - 6
            if chunk_id == 0xA300:  # Mapping Filename
                name_bytes = b''
                # Read until null terminator
                while True:
                    c = f.read(1)
                    if not c or c == b'\x00':
                        break
                    name_bytes += c
                try:
                    name = name_bytes.decode('ascii')
                except UnicodeDecodeError:
                    name = name_bytes.decode('latin-1')
                paths.append(name)
                # Skip any leftover bytes in this chunk
                f.seek(data_len - len(name_bytes) - 1, 1)
            else:
                # Skip this chunk's data
                f.seek(data_len, 1)
    return paths


def main():
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <path/to/model.3ds>")
        sys.exit(1)

    input_path = sys.argv[1]
    textures = extract_3ds_texture_paths(input_path)

    if textures:
        print("Referenced textures:")
        for tex in textures:
            print(f"- {tex}")
    else:
        print("No texture filenames found in the .3ds file.")


if __name__ == '__main__':
    main()
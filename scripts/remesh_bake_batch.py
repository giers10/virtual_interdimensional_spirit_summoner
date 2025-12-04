import bpy
import sys
import os
import math

# ----------- Argument Handling -----------
# Get input and output file from command line args
argv = sys.argv
if "--" not in argv:
    print("ERROR: No arguments passed. Usage: blender --background --python remesh_bake_batch.py -- /path/to/input.glb [/path/to/output.glb]")
    sys.exit(1)
argv = argv[argv.index("--") + 1:]
input_path = os.path.abspath(argv[0])
output_path = os.path.abspath(argv[1]) if len(argv) > 1 else os.path.splitext(input_path)[0] + "_remesh.glb"

# ----------- Scene Cleanup -----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes: bpy.data.meshes.remove(block)
for block in bpy.data.materials: bpy.data.materials.remove(block)
for block in bpy.data.images: bpy.data.images.remove(block)
for block in bpy.data.textures: bpy.data.textures.remove(block)
for block in bpy.data.lights: bpy.data.lights.remove(block)
for block in bpy.data.cameras: bpy.data.cameras.remove(block)

# ----------- Import GLB -----------
print(f"Importing {input_path}...")
bpy.ops.import_scene.gltf(filepath=input_path)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not objs:
    print("ERROR: No mesh objects found in the imported file.")
    sys.exit(1)
high = objs[0]

# ----------- Optional: Center object and apply transforms -----------
bpy.context.view_layer.objects.active = high
bpy.ops.object.select_all(action='DESELECT')
high.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ----------- Remesh via QuadRemesher -----------
# NOTE: You need QuadRemesher installed & activated in your Blender install!
bpy.ops.object.select_all(action='DESELECT')
high.select_set(True)
bpy.context.view_layer.objects.active = high
bpy.ops.qremesher.remesh()
# Wait for new mesh to appear
import time
max_wait = 60
before = set(bpy.context.scene.objects)
for t in range(max_wait * 10):
    after = set(bpy.context.scene.objects)
    new_objs = [o for o in after - before if o.type == 'MESH']
    if new_objs:
        low = sorted(new_objs, key=lambda o: len(o.name))[0]
        break
    time.sleep(0.1)
else:
    print("ERROR: Remeshed object not found after 60s.")
    sys.exit(1)

# ----------- UV Mapping & Packing -----------
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.context.view_layer.objects.active = low

while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.03)
bpy.ops.uv.pack_islands(margin=0.003)
bpy.ops.object.mode_set(mode='OBJECT')

# ----------- Material & Bake Setup -----------
mat = bpy.data.materials.new(f"{low.name}_BakeMat")
mat.use_nodes = True
low.data.materials.clear()
low.data.materials.append(mat)
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial'); out.location = (300, 0)
bsdf = nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (0, 0)
links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

# --- Diffuse Image ---
diff = nodes.new('ShaderNodeTexImage')
diff.name = diff.label = "Diffuse"
diff.location = (-400, 200)
img_diff = bpy.data.images.new(f"{low.name}_Diffuse", 1024, 1024)
diff.image = img_diff

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.use_bake_selected_to_active = False  # Only bake from itself!
scene.cycles.bake_margin = 16
scene.cycles.bake_type = 'DIFFUSE'
scene.cycles.use_bake_direct   = False
scene.cycles.use_bake_indirect = False
scene.cycles.use_bake_color    = True

bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.context.view_layer.objects.active = low

for n in nodes: n.select = False
diff.select = True; nodes.active = diff
bpy.ops.object.bake(type='DIFFUSE')
links.new(diff.outputs['Color'], bsdf.inputs['Base Color'])

# --- Normal Image ---
norm_img = bpy.data.images.new(f"{low.name}_Normal", 1024, 1024)
norm = nodes.new('ShaderNodeTexImage')
norm.name = norm.label = "Normal"
norm.location = (-400, -200)
norm.image = norm_img

scene.cycles.bake_type = 'NORMAL'
scene.cycles.normal_space = 'TANGENT'

for n in nodes: n.select = False
norm.select = True; nodes.active = norm
bpy.ops.object.bake(type='NORMAL')

nm_node = nodes.new('ShaderNodeNormalMap')
nm_node.location = (-150, -200)
nm_node.inputs['Strength'].default_value = 0.5
links.new(norm.outputs['Color'], nm_node.inputs['Color'])
links.new(nm_node.outputs['Normal'], bsdf.inputs['Normal'])

bsdf.inputs['Metallic'].default_value = 1.0
bsdf.inputs['Roughness'].default_value = 0.95

# ----------- Export as GLB -----------
print(f"Exporting {output_path}...")
bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_selected=False)
print("✅ Done.")

# ----------- Optional: Save Baked Images Externally -----------
img_diff.filepath_raw = os.path.splitext(output_path)[0] + "_diffuse.png"
img_diff.file_format = 'PNG'
img_diff.save()

norm_img.filepath_raw = os.path.splitext(output_path)[0] + "_normal.png"
norm_img.file_format = 'PNG'
norm_img.save()

print("✅ Images saved.")
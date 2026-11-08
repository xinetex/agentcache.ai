import bpy
import math
import os
import sys

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(args) != 1:
    raise SystemExit("Pass exactly one approved output directory after --")
output_dir = os.path.abspath(args[0])
if not os.path.isdir(output_dir):
    raise SystemExit("Output directory must already exist")

blend_path = os.path.join(output_dir, "product-turntable.blend")
image_path = os.path.join(output_dir, "product-turntable.png")
if os.path.exists(blend_path) or os.path.exists(image_path):
    raise SystemExit("Refusing to overwrite an existing output")

# Start from an empty scene.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0.0, roughness=0.4):
    mat = bpy.data.materials.new(name=name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

product_mat = material("Deep teal enamel", (0.025, 0.34, 0.38), 0.35, 0.24)
base_mat = material("Warm porcelain", (0.82, 0.72, 0.56), 0.05, 0.32)
floor_mat = material("Dark studio floor", (0.035, 0.047, 0.065), 0.0, 0.65)

# A beveled product block on a circular display plinth.
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.65, depth=0.28, location=(0, 0, 0.14))
plinth = bpy.context.object
plinth.name = "Display plinth"
plinth.data.materials.append(base_mat)
bevel = plinth.modifiers.new("Soft machined edges", "BEVEL")
bevel.width = 0.08
bevel.segments = 3
plinth.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.15))
product = bpy.context.object
product.name = "Product"
product.dimensions = (1.25, 0.82, 1.65)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
product.data.materials.append(product_mat)
bevel = product.modifiers.new("Rounded product edges", "BEVEL")
bevel.width = 0.12
bevel.segments = 6
product.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")

# Ground plane.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.02))
floor = bpy.context.object
floor.name = "Studio floor"
floor.data.materials.append(floor_mat)

# Product rotation animation: a full turn over 120 frames.
product.rotation_mode = "XYZ"
product.rotation_euler.z = 0
product.keyframe_insert(data_path="rotation_euler", index=2, frame=1)
product.rotation_euler.z = 2 * math.pi
product.keyframe_insert(data_path="rotation_euler", index=2, frame=121)

# Camera and soft studio lighting.
bpy.ops.object.camera_add(location=(4.6, -6.8, 4.0))
camera = bpy.context.object
camera.name = "Camera"
target = bpy.data.objects.new("Camera target", None)
bpy.context.collection.objects.link(target)
target.location = (0, 0, 0.95)
track = camera.constraints.new(type="TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"
camera.data.lens = 55
bpy.context.scene.camera = camera

def area_light(name, location, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color
    light.rotation_euler = (target.location - light.location).to_track_quat("-Z", "Y").to_euler()

area_light("Key softbox", (1.5, -3.5, 6.0), 700, 4.0, (0.78, 0.9, 1.0))
area_light("Warm rim", (-3.5, 1.2, 4.2), 900, 3.0, (1.0, 0.58, 0.3))
area_light("Front fill", (4.0, 2.0, 2.8), 450, 3.0, (0.38, 0.78, 1.0))

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 121
scene.frame_set(1)
engine_ids = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
if "BLENDER_EEVEE_NEXT" in engine_ids:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
elif "BLENDER_EEVEE" in engine_ids:
    scene.render.engine = "BLENDER_EEVEE"
else:
    raise SystemExit("This playbook requires an available Eevee render engine")
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = image_path
scene.render.film_transparent = False
scene.world.color = (0.12, 0.12, 0.12)
view_transform_ids = {item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items}
scene.view_settings.view_transform = "AgX" if "AgX" in view_transform_ids else "Standard"

# Save before rendering so a render failure still leaves the project available.
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.render.render(write_still=True)

if not os.path.isfile(blend_path) or os.path.getsize(blend_path) == 0:
    raise SystemExit("Project save check failed")
if not os.path.isfile(image_path) or os.path.getsize(image_path) == 0:
    raise SystemExit("Render output check failed")
print("PLAYBOOK_OUTPUTS", blend_path, image_path)

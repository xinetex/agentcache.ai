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

blend_path = os.path.join(output_dir, "typographic-title-card.blend")
image_path = os.path.join(output_dir, "typographic-title-card.png")
if os.path.exists(blend_path) or os.path.exists(image_path):
    raise SystemExit("Refusing to overwrite an existing output")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def make_material(name, color, metallic=0.0, roughness=0.35):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material

ink = make_material("Champagne metal", (0.92, 0.58, 0.22), 0.65, 0.22)
backdrop = make_material("Midnight blue", (0.018, 0.055, 0.12), 0.12, 0.38)

# The words and backing are generated locally; no fonts or image assets are fetched.
bpy.ops.object.text_add(location=(0, -0.02, 0))
title = bpy.context.object
title.name = "Title - MAKE IT REAL"
title.data.body = "MAKE\nIT REAL"
title.data.align_x = "CENTER"
title.data.align_y = "CENTER"
title.data.size = 1.05
title.data.space_line = 0.9
title.data.extrude = 0.075
title.data.bevel_depth = 0.018
title.data.bevel_resolution = 3
title.rotation_euler.x = math.radians(90)
title.data.materials.append(ink)

bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0.22, 0))
panel = bpy.context.object
panel.name = "Title card backing"
panel.rotation_euler.x = math.radians(90)
panel.scale = (3.7, 2.7, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
panel.data.materials.append(backdrop)

target = bpy.data.objects.new("Camera target", None)
bpy.context.collection.objects.link(target)
target.location = (0, 0, 0)
bpy.ops.object.camera_add(location=(0, -8.5, 0.25))
camera = bpy.context.object
camera.name = "Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 7.4
camera.rotation_euler = (target.location - camera.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera

def add_area(name, location, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color
    light.rotation_euler = (target.location - light.location).to_track_quat("-Z", "Y").to_euler()

add_area("Warm key", (-3.2, -4.5, 4.2), 750, 3.5, (1.0, 0.72, 0.42))
add_area("Cool fill", (3.0, -3.4, -1.6), 500, 3.0, (0.42, 0.68, 1.0))

scene = bpy.context.scene
engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
if "BLENDER_EEVEE_NEXT" in engines:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
elif "BLENDER_EEVEE" in engines:
    scene.render.engine = "BLENDER_EEVEE"
else:
    raise SystemExit("This playbook requires an available Eevee render engine")
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = image_path
scene.render.film_transparent = False
view_transforms = {item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items}
scene.view_settings.view_transform = "AgX" if "AgX" in view_transforms else "Standard"
scene.world.color = (0.08, 0.08, 0.08)

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.render.render(write_still=True)
for file_path in (blend_path, image_path):
    if not os.path.isfile(file_path) or os.path.getsize(file_path) == 0:
        raise SystemExit("Output check failed: " + file_path)
print("PLAYBOOK_OUTPUTS", blend_path, image_path)

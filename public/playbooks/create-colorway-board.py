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

blend_path = os.path.join(output_dir, "product-colorway-board.blend")
image_path = os.path.join(output_dir, "product-colorway-board.png")
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

variants = [
    ("01 - OCEAN", (0.025, 0.28, 0.42)),
    ("02 - CITRUS", (0.72, 0.31, 0.045)),
    ("03 - MOSS", (0.16, 0.38, 0.20)),
]
cap_material = make_material("Soft silver caps", (0.68, 0.74, 0.78), 0.72, 0.24)
floor_material = make_material("Warm studio floor", (0.075, 0.085, 0.095), 0.0, 0.58)

for i, (label, color) in enumerate(variants):
    x = (i - 1) * 2.25
    body_material = make_material(label + " enamel", color, 0.22, 0.27)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.56, depth=1.65, location=(x, 0, 1.0))
    body = bpy.context.object
    body.name = label + " bottle body"
    body.data.materials.append(body_material)
    bevel = body.modifiers.new("Rounded bottle edges", "BEVEL")
    bevel.width = 0.11
    bevel.segments = 4
    body.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")

    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.24, depth=0.28, location=(x, 0, 1.96))
    cap = bpy.context.object
    cap.name = label + " cap"
    cap.data.materials.append(cap_material)
    bevel = cap.modifiers.new("Cap edge", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 3
    cap.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")

    bpy.ops.object.text_add(location=(x, -0.575, 0.82))
    text = bpy.context.object
    text.name = label + " label"
    text.data.body = label.split(" - ")[1]
    text.data.align_x = "CENTER"
    text.data.align_y = "CENTER"
    text.data.size = 0.19
    text.rotation_euler.x = math.radians(90)
    text.data.materials.append(make_material(label + " label ink", (0.96, 0.92, 0.82), 0.0, 0.42))

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0.08))
floor = bpy.context.object
floor.name = "Studio floor"
floor.data.materials.append(floor_material)

target = bpy.data.objects.new("Camera target", None)
bpy.context.collection.objects.link(target)
target.location = (0, 0, 1.35)
bpy.ops.object.camera_add(location=(0, -10.5, 3.1))
camera = bpy.context.object
camera.name = "Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 8.2
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

add_area("Large softbox", (-3.8, -4.5, 6.0), 950, 4.5, (1.0, 0.82, 0.65))
add_area("Cool fill", (4.0, -2.5, 3.6), 600, 3.2, (0.62, 0.78, 1.0))
add_area("Top rim", (0.0, 2.8, 5.0), 800, 3.0, (1.0, 0.55, 0.24))

scene = bpy.context.scene
engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
if "BLENDER_EEVEE_NEXT" in engines:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
elif "BLENDER_EEVEE" in engines:
    scene.render.engine = "BLENDER_EEVEE"
else:
    raise SystemExit("This playbook requires an available Eevee render engine")
scene.render.resolution_x = 1200
scene.render.resolution_y = 750
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

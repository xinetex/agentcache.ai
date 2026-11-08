import bpy
import math
import os
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(args) != 1:
    raise SystemExit("Pass exactly one approved output directory after --")
output_dir = os.path.abspath(args[0])
if not os.path.isdir(output_dir):
    raise SystemExit("Output directory must already exist")

blend_path = os.path.join(output_dir, "exploded-desk-lamp.blend")
image_path = os.path.join(output_dir, "exploded-desk-lamp.png")
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

def finish_mesh(obj, material, bevel=0.0):
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj

def cylinder(name, radius, depth, location, material, bevel=0.04, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = finish_mesh(bpy.context.object, material, bevel)
    obj.name = name
    return obj

def sphere(name, radius, location, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=radius, location=location)
    obj = finish_mesh(bpy.context.object, material)
    obj.name = name
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

def label(body, location, material, camera_location):
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.object
    obj.data.body = body
    obj.data.size = 0.16
    obj.data.extrude = 0.001
    obj.data.align_x = "LEFT"
    obj.rotation_euler = (Vector(camera_location) - obj.location).to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    return obj

porcelain = make_material("Warm porcelain", (0.78, 0.72, 0.60), 0.08, 0.24)
brass = make_material("Brushed brass", (0.55, 0.31, 0.095), 0.78, 0.23)
opal = make_material("Opal diffuser", (0.83, 0.93, 0.88), 0.0, 0.2)
dark_metal = make_material("Graphite stem", (0.11, 0.16, 0.17), 0.72, 0.25)
ink = make_material("Warm label ink", (0.92, 0.84, 0.66), 0.0, 0.45)
floor_material = make_material("Studio floor", (0.045, 0.06, 0.07), 0.0, 0.58)

# Separate, named components are offset along the lamp's main axis to make
# assembly order and ownership of each part easy to inspect.
parts = []
parts.append(cylinder("01 Base - weighted foot", 0.72, 0.28, (0, 0, 0.22), porcelain, 0.07))
parts.append(cylinder("02 Stem - vertical support", 0.105, 1.1, (0, 0, 1.12), dark_metal, 0.025))
parts.append(cylinder("03 Collar - stem connector", 0.19, 0.18, (0, 0, 2.02), brass, 0.035))
parts.append(sphere("04 Diffuser - opal globe", 0.36, (0, 0, 2.55), opal))

bpy.ops.mesh.primitive_cone_add(vertices=96, radius1=0.92, radius2=0.30, depth=0.62, location=(0, 0, 3.42))
shade = finish_mesh(bpy.context.object, porcelain, 0.035)
shade.name = "05 Shade - tapered shell"
parts.append(shade)
parts.append(cylinder("06 Finial - top cap", 0.16, 0.2, (0, 0, 3.98), brass, 0.04))

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0.025))
floor = bpy.context.object
floor.name = "Studio floor"
floor.data.materials.append(floor_material)

target = bpy.data.objects.new("Camera target", None)
bpy.context.collection.objects.link(target)
target.location = (0.55, 0.0, 2.15)
camera_location = (6.4, -10.5, 5.5)
bpy.ops.object.camera_add(location=camera_location)
camera = bpy.context.object
camera.name = "Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 6.2
camera.rotation_euler = (target.location - camera.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera

for name, z in [("BASE", 0.22), ("STEM", 1.12), ("COLLAR", 2.02), ("DIFFUSER", 2.55), ("SHADE", 3.42), ("FINIAL", 3.98)]:
    label(name, (1.12, -0.15, z), ink, camera_location)

def add_area(name, location, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color
    light.rotation_euler = (target.location - light.location).to_track_quat("-Z", "Y").to_euler()

add_area("Large warm softbox", (-3.8, -4.5, 6.3), 1000, 4.5, (1.0, 0.82, 0.65))
add_area("Cool fill", (4.0, -2.5, 3.8), 650, 3.2, (0.62, 0.78, 1.0))
add_area("Top rim", (0.0, 2.8, 5.4), 850, 3.0, (1.0, 0.58, 0.27))

scene = bpy.context.scene
engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
if "BLENDER_EEVEE_NEXT" in engines:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
elif "BLENDER_EEVEE" in engines:
    scene.render.engine = "BLENDER_EEVEE"
else:
    raise SystemExit("This playbook requires an available Eevee render engine")
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = image_path
scene.render.film_transparent = False
view_transforms = {item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items}
scene.view_settings.view_transform = "AgX" if "AgX" in view_transforms else "Standard"
scene.world.color = (0.06, 0.06, 0.06)

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.render.render(write_still=True)
if len(parts) != 6 or len({part.name for part in parts}) != 6:
    raise SystemExit("Scene check failed: expected six separate named lamp components")
for file_path in (blend_path, image_path):
    if not os.path.isfile(file_path) or os.path.getsize(file_path) == 0:
        raise SystemExit("Output check failed: " + file_path)
print("PLAYBOOK_OUTPUTS", blend_path, image_path)

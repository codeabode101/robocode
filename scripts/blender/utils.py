"""
Shared Blender utilities for generating post-apocalyptic building models.
Run via: blender --background --python utils.py
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for col in bpy.data.collections:
        bpy.data.collections.remove(col)


def set_units():
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0


def mat(name, color, roughness=0.8, metallic=0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
    return m


def create_box(name, size, location, material=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0]/2, size[1]/2, size[2]/2)
    bpy.ops.object.transform_apply(scale=True)
    if material:
        obj.data.materials.append(material)
    return obj


def create_cylinder(name, radius, depth, location, material=None, segments=12, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=segments, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


def cut_hole(base_obj, hole_size, hole_loc, hole_rot=(0,0,0)):
    """Boolean subtract a hole from a mesh."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=hole_loc)
    cutter = bpy.context.active_object
    cutter.scale = (hole_size[0]/2, hole_size[1]/2, hole_size[2]/2)
    cutter.rotation_euler = hole_rot
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    bpy.context.view_layer.objects.active = base_obj
    base_obj.select_set(True)
    mod = base_obj.modifiers.new(name="BoolCut", type='BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier="BoolCut")
    bpy.data.objects.remove(cutter, do_unlink=True)
    return base_obj


def scatter_debris(group, cx, cy, count, radius, materials, z_base=0.05):
    """Scatter debris objects around a point."""
    for i in range(count):
        a = random.random() * math.pi * 2
        d = random.random() * radius
        x = cx + math.cos(a) * d
        y = cy + math.sin(a) * d
        z = z_base + random.random() * 0.05
        rtype = random.random()
        if rtype < 0.4:
            s = 0.05 + random.random() * 0.12
            bpy.ops.mesh.primitive_ico_sphere_add(radius=s, subdivisions=1, location=(x, y, z))
            obj = bpy.context.active_object
            obj.name = f"debris_{i}"
            obj.scale = (1 + random.random()*0.5, 1 + random.random()*0.3, 0.5 + random.random()*0.5)
            bpy.ops.object.transform_apply(scale=True)
        elif rtype < 0.7:
            s = 0.08 + random.random() * 0.2
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
            obj = bpy.context.active_object
            obj.name = f"debris_plank_{i}"
            obj.scale = (s, s*0.15, 0.02)
            bpy.ops.object.transform_apply(scale=True)
            obj.rotation_euler = (0, 0, random.random() * math.pi)
        else:
            r = 0.03 + random.random() * 0.06
            h = 0.15 + random.random() * 0.3
            bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=5, location=(x, y, z + h/2))
            obj = bpy.context.active_object
            obj.name = f"debris_rebar_{i}"
            obj.rotation_euler = (random.random()*0.5 - 0.25, random.random()*0.5 - 0.25, random.random()*math.pi)
        mat_choice = random.choice(materials)
        obj.data.materials.append(mat_choice)
    return group


def export_glb(path):
    """Export scene as GLB."""
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
    )


# Material palettes
def make_concrete_palette():
    return {
        'wall': mat("concrete_wall", (0.29, 0.29, 0.33), 0.9),
        'trim': mat("concrete_trim", (0.20, 0.20, 0.24), 0.85),
        'accent': mat("concrete_accent", (0.35, 0.35, 0.39), 0.8),
        'glass': mat("glass_dark", (0.04, 0.04, 0.06), 0.3),
        'board': mat("wood_board", (0.35, 0.23, 0.16), 0.9),
        'rebar': mat("rust_rebar", (0.54, 0.29, 0.16), 0.7, 0.6),
        'steel': mat("steel_frame", (0.33, 0.33, 0.33), 0.5, 0.8),
        'veg': mat("vegetation", (0.23, 0.48, 0.23), 0.95),
        'rubble': mat("concrete_rubble", (0.35, 0.33, 0.30), 0.9),
    }

def make_brick_palette():
    return {
        'wall': mat("brick_wall", (0.48, 0.29, 0.20), 0.9),
        'trim': mat("brick_trim", (0.36, 0.21, 0.13), 0.85),
        'accent': mat("brick_accent", (0.55, 0.35, 0.23), 0.8),
        'glass': mat("glass_dark2", (0.04, 0.04, 0.06), 0.3),
        'board': mat("wood_board2", (0.35, 0.23, 0.16), 0.9),
        'rebar': mat("rust_rebar2", (0.54, 0.29, 0.16), 0.7, 0.6),
        'steel': mat("steel_frame2", (0.33, 0.33, 0.33), 0.5, 0.8),
        'veg': mat("vegetation2", (0.23, 0.48, 0.23), 0.95),
        'rubble': mat("brick_rubble", (0.40, 0.28, 0.20), 0.9),
    }

def make_slate_palette():
    return {
        'wall': mat("slate_wall", (0.16, 0.23, 0.29), 0.85),
        'trim': mat("slate_trim", (0.10, 0.16, 0.23), 0.8),
        'accent': mat("slate_accent", (0.23, 0.29, 0.35), 0.75),
        'glass': mat("glass_dark3", (0.04, 0.04, 0.06), 0.3),
        'board': mat("wood_board3", (0.35, 0.23, 0.16), 0.9),
        'rebar': mat("rust_rebar3", (0.54, 0.29, 0.16), 0.7, 0.6),
        'steel': mat("steel_frame3", (0.33, 0.33, 0.33), 0.5, 0.8),
        'veg': mat("vegetation3", (0.23, 0.48, 0.23), 0.95),
        'rubble': mat("slate_rubble", (0.20, 0.25, 0.30), 0.9),
    }

def make_wood_palette():
    return {
        'wall': mat("wood_wall", (0.42, 0.26, 0.15), 0.9),
        'trim': mat("wood_trim", (0.29, 0.18, 0.09), 0.85),
        'accent': mat("wood_accent", (0.50, 0.33, 0.19), 0.8),
        'glass': mat("glass_dark4", (0.04, 0.04, 0.06), 0.3),
        'board': mat("wood_board4", (0.35, 0.23, 0.16), 0.9),
        'rebar': mat("rust_rebar4", (0.54, 0.29, 0.16), 0.7, 0.6),
        'steel': mat("steel_frame4", (0.33, 0.33, 0.33), 0.5, 0.8),
        'veg': mat("vegetation4", (0.23, 0.48, 0.23), 0.95),
        'rubble': mat("wood_rubble", (0.35, 0.22, 0.14), 0.9),
    }

PALETTES = [make_concrete_palette, make_brick_palette, make_slate_palette, make_wood_palette]

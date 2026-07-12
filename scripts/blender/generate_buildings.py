"""
Post-apocalyptic building generator — solid-shell buildings for top-down camera.

KEY FIX: Previous version built per-floor walls (0.12 thick each), creating
visible floating planes from the camera angle. This version builds:
1. Solid exterior walls from ground to roof (one piece)
2. Floor slabs INSIDE the shell (not visible from outside)
3. Window/door holes cut into the solid walls
4. Rich roof details (visible from top-down camera)
5. Wall-mounted facade details (pipes, graffiti, signs)

Run: blender --background --python scripts/blender/generate_buildings.py
"""
import bpy
import bmesh
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils import (
    clear_scene, set_units, mat, create_box, create_cylinder,
    cut_hole, scatter_debris, export_glb,
    PALETTES, make_concrete_palette, make_brick_palette, make_slate_palette, make_wood_palette,
)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models')
os.makedirs(OUTPUT_DIR, exist_ok=True)

random.seed(42)

BLACK = mat("black_void", (0.02, 0.02, 0.03), 0.95)
STAIN = mat("wall_stain", (0.08, 0.08, 0.08), 0.95)
GRAFFITI_MATS = [
    mat("graffiti_red", (0.86, 0.15, 0.15), 0.9),
    mat("graffiti_blue", (0.15, 0.39, 0.92), 0.9),
    mat("graffiti_green", (0.09, 0.64, 0.29), 0.9),
    mat("graffiti_yellow", (0.96, 0.62, 0.04), 0.9),
]


def build_solid_walls(bw, bd, h, wall_mat, group, hole_chance=0.25):
    """4 solid exterior walls from ground to roof — ONE piece each, not per-floor."""
    thick = 0.18
    wall_h = h - 0.15  # Stop just below roof slab

    walls = []
    for side in ['south', 'north', 'east', 'west']:
        if side == 'south':
            w = create_box("wall_s", (bw, thick, wall_h), (0, -bd/2, wall_h/2), wall_mat, group)
        elif side == 'north':
            w = create_box("wall_n", (bw, thick, wall_h), (0, bd/2, wall_h/2), wall_mat, group)
        elif side == 'east':
            w = create_box("wall_e", (thick, bd, wall_h), (bw/2, 0, wall_h/2), wall_mat, group)
        else:
            w = create_box("wall_w", (thick, bd, wall_h), (-bw/2, 0, wall_h/2), wall_mat, group)

        # Cut window/door holes
        if side in ('south', 'north'):
            span = bw
        else:
            span = bd

        n_holes = max(1, int(span * hole_chance / 0.6))
        for hi in range(n_holes):
            if random.random() > hole_chance * 1.5:
                continue
            hole_w = 0.25 + random.random() * 0.45
            hole_h = 0.3 + random.random() * 0.5
            hx = (random.random() - 0.5) * (span - hole_w - 0.6)
            # Vary hole height — some near ground, some upper
            hz = random.choice([
                0.3 + hole_h/2,                          # Ground level
                wall_h * 0.45 + random.uniform(-0.2, 0.2),  # Mid height
                wall_h * 0.75 + random.uniform(-0.15, 0.15), # Upper
            ])
            hz = max(hole_h/2 + 0.05, min(hz, wall_h - hole_h/2 - 0.05))

            if side in ('south', 'north'):
                hole_loc = (hx, bd/2 * (1 if side == 'north' else -1), hz)
            else:
                hole_loc = (bw/2 * (1 if side == 'east' else -1), hx, hz)

            cut_hole(w, (hole_w, 0.25, hole_h), hole_loc)
            create_box("hole_dark", (hole_w - 0.04, 0.06, hole_h - 0.04),
                       hole_loc, BLACK, group)

        walls.append(w)
    return walls


def build_interior_floors(bw, bd, stories, floor_mat, group):
    """Interior floor slabs — invisible from outside, provide structural detail in GLB."""
    fh = 1.0
    for f in range(1, stories):
        z = f * fh
        create_box(f"floor_{f}", (bw - 0.36, bd - 0.36, 0.06), (0, 0, z), floor_mat, group)


def build_roof_assembly(bw, bd, h, palette, group):
    """Roof slab + parapet + rich detail."""
    # Main roof slab
    create_box("roof_slab", (bw + 0.1, bd + 0.1, 0.15), (0, 0, h - 0.075), palette['trim'], group)

    # Parapet walls around edge
    ph = 0.2
    pt = 0.08
    for side in ['south', 'north', 'east', 'west']:
        if side == 'south':
            create_box("para_s", (bw + 0.1, pt, ph), (0, -bd/2, h + ph/2), palette['accent'], group)
        elif side == 'north':
            create_box("para_n", (bw + 0.1, pt, ph), (0, bd/2, h + ph/2), palette['accent'], group)
        elif side == 'east':
            create_box("para_e", (pt, bd + 0.1, ph), (bw/2, 0, h + ph/2), palette['accent'], group)
        else:
            create_box("para_w", (pt, bd + 0.1, ph), (-bw/2, 0, h + ph/2), palette['accent'], group)


def build_roof_details(bw, bd, h, palette, group):
    """Rooftop objects — AC units, tanks, vents, vegetation, puddles, collapse."""
    top = h + 0.08

    # Water tank / AC unit
    if random.random() > 0.15:
        tx = bw * 0.3 * (random.random() - 0.5)
        ty = bd * 0.3 * (random.random() - 0.5)
        create_cylinder("tank", 0.2, 0.3, (tx, ty, top + 0.15), palette['steel'], 10, group)
        create_cylinder("tank_cap", 0.15, 0.06, (tx, ty, top + 0.33), palette['accent'], 10, group)
        for lx, ly in [(-0.1, -0.1), (0.1, -0.1), (-0.1, 0.1), (0.1, 0.1)]:
            create_cylinder("leg", 0.015, 0.12, (tx+lx, ty+ly, top + 0.06), palette['steel'], 4, group)

    # Roof access shed
    if random.random() > 0.3:
        sw = 0.3 + random.random() * 0.3
        sd = sw * (0.6 + random.random() * 0.3)
        sx = (random.random() - 0.5) * bw * 0.3
        sy = (random.random() - 0.5) * bd * 0.3
        shed_h = 0.25 + random.random() * 0.15
        create_box("shed", (sw, sd, shed_h), (sx, sy, top + shed_h/2 + 0.03), palette['wall'], group)
        create_box("shed_door", (sw*0.35, 0.03, shed_h*0.7),
                   (sx, sy + sd/2 + 0.02, top + shed_h*0.35 + 0.03), palette['accent'], group)

    # Vents
    for vi in range(random.randint(1, 3)):
        vx = bw * 0.35 * (random.random() - 0.5)
        vy = bd * 0.35 * (random.random() - 0.5)
        vw = 0.1 + random.random() * 0.12
        vh = 0.05 + random.random() * 0.06
        create_box(f"vent_{vi}", (vw, vw, vh), (vx, vy, top + vh/2 + 0.03), palette['steel'], group)
        create_box(f"vent_grate_{vi}", (vw*0.85, vw*0.85, 0.01),
                   (vx, vy, top + vh + 0.04), palette['glass'], group)

    # Satellite dish
    if random.random() > 0.5:
        dx = bw * 0.25 * (random.choice([-1, 1]))
        dy = bd * 0.3 * (random.choice([-1, 1]))
        create_cylinder("dish", 0.15, 0.03, (dx, dy, top + 0.14), palette['steel'], 10, group)
        create_cylinder("dish_pole", 0.012, 0.12, (dx, dy, top + 0.07), palette['steel'], 4, group)

    # Antenna
    if random.random() > 0.4:
        ax = bw * 0.35 * (random.choice([-1, 1]))
        ay = bd * 0.35 * (random.choice([-1, 1]))
        ant_h = 0.3 + random.random() * 0.3
        ant = create_cylinder("antenna", 0.012, ant_h, (ax, ay, top + ant_h/2 + 0.03), palette['steel'], 4, group)
        ant.rotation_euler = (0, 0, random.uniform(-0.15, 0.15))
        create_cylinder("ant_tip", 0.02, 0.03, (ax, ay, top + ant_h + 0.05),
                        mat("red_tip", (0.8, 0.1, 0.1), 0.5, 0.0), 6, group)

    # Vegetation on roof
    for vi in range(random.randint(2, 5)):
        vw = 0.15 + random.random() * 0.5
        vd = 0.1 + random.random() * 0.4
        vx = (random.random() - 0.5) * bw * 0.7
        vy = (random.random() - 0.5) * bd * 0.7
        create_box(f"veg_{vi}", (vw, vd, 0.02), (vx, vy, top + 0.03), palette['veg'], group)

    # Puddles
    for pi in range(random.randint(1, 3)):
        pr = 0.1 + random.random() * 0.2
        px = (random.random() - 0.5) * bw * 0.5
        py = (random.random() - 0.5) * bd * 0.5
        create_cylinder(f"puddle_{pi}", pr, 0.008, (px, py, top + 0.03),
                        mat("water", (0.12, 0.22, 0.35), 0.15, 0.1), 8, group)

    # Collapsed section
    if random.random() > 0.45:
        cw = 0.5 + random.random() * 0.8
        cd = 0.5 + random.random() * 0.6
        cx = bw * 0.3 * (random.choice([-1, 1]))
        cy = bd * 0.3 * (random.choice([-1, 1]))
        create_box("collapse_hole", (cw, cd, 0.16), (cx, cy, top + 0.01), BLACK, group)
        for ri in range(4):
            rx = cx + (random.random() - 0.5) * cw * 1.2
            ry = cy + (random.random() - 0.5) * cd * 1.2
            rs = 0.04 + random.random() * 0.08
            bpy.ops.mesh.primitive_ico_sphere_add(radius=rs, subdivisions=1, location=(rx, ry, top + 0.05))
            robj = bpy.context.active_object
            robj.name = f"collapse_rubble_{ri}"
            robj.scale = (1 + random.random()*0.5, 1 + random.random()*0.3, 0.4 + random.random()*0.4)
            bpy.ops.object.transform_apply(scale=True)
            robj.data.materials.append(random.choice([palette['wall'], palette['rubble']]))

    # Exposed rebar along edges
    for ri in range(random.randint(2, 6)):
        rx = bw * 0.5 * (random.random() - 0.5)
        ry = bd/2 * (random.choice([-1, 1]))
        rh = 0.08 + random.random() * 0.15
        rebar = create_cylinder(f"rebar_{ri}", 0.008, rh,
                                (rx, ry, top + rh/2), palette['rebar'], 4, group)
        rebar.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), 0)


def build_wall_windows(bw, bd, h, palette, group, win_h=0.35, win_w=0.28):
    """Windows on south+north walls — attached to exterior surface."""
    count = max(2, int(bw / 0.75))
    spacing = bw / count
    for i in range(count):
        wx = -bw/2 + spacing * (i + 0.5)
        state = random.random()
        for side_sign in [-1, 1]:
            sy = side_sign * (bd/2 + 0.02)  # Just outside wall surface
            wy = h * 0.5
            if state < 0.25:
                # Boarded window
                create_box(f"board_{i}_{side_sign}", (win_w + 0.04, 0.03, win_h + 0.04),
                           (wx, sy, wy), palette['board'], group)
                create_box(f"plank_x_{i}_{side_sign}", (win_w + 0.08, 0.02, 0.025),
                           (wx, sy + side_sign * 0.01, wy), palette['wall'], group)
                create_box(f"plank_y_{i}_{side_sign}", (0.025, 0.02, win_h + 0.08),
                           (wx, sy + side_sign * 0.01, wy), palette['wall'], group)
            elif state < 0.5:
                # Window frame + dark glass
                create_box(f"glass_{i}_{side_sign}", (win_w, 0.02, win_h),
                           (wx, sy, wy), palette['glass'], group)
                create_box(f"frame_t_{i}_{side_sign}", (win_w + 0.04, 0.025, 0.025),
                           (wx, sy + side_sign * 0.01, wy + win_h/2), palette['trim'], group)
                create_box(f"frame_b_{i}_{side_sign}", (win_w + 0.04, 0.025, 0.025),
                           (wx, sy + side_sign * 0.01, wy - win_h/2), palette['trim'], group)
                create_box(f"frame_l_{i}_{side_sign}", (0.025, 0.025, win_h),
                           (wx - win_w/2, sy + side_sign * 0.01, wy), palette['trim'], group)
                create_box(f"frame_r_{i}_{side_sign}", (0.025, 0.025, win_h),
                           (wx + win_w/2, sy + side_sign * 0.01, wy), palette['trim'], group)
            elif state < 0.7:
                # Broken glass shard
                create_box(f"broken_{i}_{side_sign}", (win_w * 0.7, 0.02, win_h * 0.6),
                           (wx, sy, wy - 0.05), palette['glass'], group)
                shard = create_box(f"shard_{i}_{side_sign}", (0.05, 0.015, 0.1),
                                   (wx + win_w*0.3, sy + side_sign * 0.03, wy - 0.08), palette['glass'], group)
                shard.rotation_euler = (0, 0, random.uniform(-0.5, 0.5))
            elif state < 0.85:
                # Open hole
                create_box(f"win_dark_{i}_{side_sign}", (win_w, 0.06, win_h),
                           (wx, sy - side_sign * 0.01, wy), BLACK, group)
            # else: solid wall (no window here)


def build_east_west_windows(bw, bd, h, palette, group, win_h=0.3, win_w=0.22):
    """Fewer windows on east+west walls."""
    count = max(1, int(bd / 1.0))
    spacing = bd / count
    for i in range(count):
        wy = -bd/2 + spacing * (i + 0.5)
        state = random.random()
        for side_sign in [-1, 1]:
            sx = side_sign * (bw/2 + 0.02)
            wz = h * 0.5
            if state < 0.3:
                create_box(f"ew_board_{i}_{side_sign}", (0.03, win_w + 0.04, win_h + 0.04),
                           (sx, wy, wz), palette['board'], group)
            elif state < 0.6:
                create_box(f"ew_glass_{i}_{side_sign}", (0.02, win_w, win_h),
                           (sx, wy, wz), palette['glass'], group)
                create_box(f"ew_frame_t_{i}_{side_sign}", (0.025, win_w + 0.04, 0.025),
                           (sx + side_sign * 0.01, wy, wz + win_h/2), palette['trim'], group)
                create_box(f"ew_frame_b_{i}_{side_sign}", (0.025, win_w + 0.04, 0.025),
                           (sx + side_sign * 0.01, wy, wz - win_h/2), palette['trim'], group)
            elif state < 0.8:
                create_box(f"ew_dark_{i}_{side_sign}", (0.06, win_w, win_h),
                           (sx - side_sign * 0.01, wy, wz), BLACK, group)


def build_facade_details(bw, bd, h, palette, group):
    """Pipes, stains, graffiti, signs, awnings on walls."""
    # Drainpipe
    for pi in range(random.randint(1, 2)):
        px = bw * 0.4 * (random.choice([-1, 1]))
        ph = h * (0.5 + random.random() * 0.4)
        pipe = create_cylinder(f"pipe_{pi}", 0.025, ph,
                               (px, bd/2 + 0.04, ph/2), palette['steel'], 6, group)
        for j in range(2):
            create_cylinder(f"clamp_{pi}_{j}", 0.035, 0.025,
                           (px, bd/2 + 0.04, 0.3 + j * (ph/2)),
                           palette['steel'], 6, group)

    # Water stains
    for si in range(random.randint(2, 5)):
        sh = 0.15 + random.random() * 0.35
        sx = (random.random() - 0.5) * bw * 0.6
        sside = random.choice([-1, 1])
        sy = sside * (bd/2 + 0.015)
        sz = 0.1 + random.random() * (h - 0.6)
        create_box(f"stain_{si}", (0.04 + random.random()*0.06, 0.012, sh),
                   (sx, sy, sz), STAIN, group)

    # Graffiti
    for gi in range(random.randint(1, 3)):
        gmat = random.choice(GRAFFITI_MATS)
        gw = 0.2 + random.random() * 0.4
        gh = 0.15 + random.random() * 0.25
        gside = random.choice([-1, 1])
        gx = (random.random() - 0.5) * bw * 0.5
        gy = gside * (bd/2 + 0.015)
        gz = 0.2 + random.random() * (h * 0.4)
        create_box(f"graffiti_{gi}", (gw, 0.012, gh), (gx, gy, gz), gmat, group)

    # Shop sign / board
    if random.random() > 0.35:
        sign_w = 0.5 + random.random() * 0.7
        sign_side = random.choice([-1, 1])
        sx = (random.random() - 0.5) * (bw - sign_w - 0.4)
        sy = sign_side * (bd/2 + 0.04)
        sz = h * 0.6
        create_box("sign_board", (sign_w, 0.025, 0.12), (sx, sy, sz), palette['board'], group)
        for rx in [-sign_w/3, sign_w/3]:
            create_box(f"sign_bracket_{rx:.1f}", (0.02, 0.12, 0.02),
                       (sx + rx, sy + sign_side * 0.06, sz + 0.06), palette['steel'], group)

    # Awning
    if random.random() > 0.5:
        aw = 0.6 + random.random() * 0.5
        aw_side = random.choice([-1, 1])
        ax = (random.random() - 0.5) * (bw - aw - 0.4)
        ay = aw_side * (bd/2)
        aw_h = h * 0.42
        create_box("awning", (aw, 0.3, 0.035),
                   (ax, ay + aw_side * 0.15, aw_h), palette['board'], group)
        for rx in [-aw/3, aw/3]:
            create_box(f"rod_{rx:.1f}", (0.015, 0.015, 0.2),
                       (ax + rx, ay + aw_side * 0.06, aw_h - 0.1), palette['steel'], group)

    # Air conditioning box on wall
    if random.random() > 0.5:
        ac_side = random.choice([-1, 1])
        ac_x = (random.random() - 0.5) * bw * 0.5
        ac_y = ac_side * (bd/2 + 0.12)
        ac_z = h * 0.35
        create_box("ac_unit", (0.25, 0.18, 0.15), (ac_x, ac_y, ac_z), palette['steel'], group)
        create_box("ac_fan", (0.12, 0.02, 0.12), (ac_x, ac_y + ac_side * 0.08, ac_z), palette['glass'], group)


def build_rubble_base(bw, bd, palette, group):
    """Rubble, debris, vegetation at the building base."""
    count = random.randint(6, 14)
    for i in range(count):
        side = random.choice([-1, 1])
        rx = bw * 0.5 * (random.random() - 0.5)
        ry = side * (bd/2 + 0.06 + random.random() * 0.3)
        rz = 0.02 + random.random() * 0.02
        rtype = random.random()
        if rtype < 0.35:
            rs = 0.03 + random.random() * 0.06
            bpy.ops.mesh.primitive_ico_sphere_add(radius=rs, subdivisions=1, location=(rx, ry, rz))
            obj = bpy.context.active_object
            obj.name = f"rubble_{i}"
            obj.scale = (1+random.random()*0.5, 1+random.random()*0.3, 0.5+random.random()*0.4)
            bpy.ops.object.transform_apply(scale=True)
            obj.data.materials.append(random.choice([palette['wall'], palette['rubble'], palette['trim']]))
        elif rtype < 0.6:
            pw = 0.08 + random.random() * 0.18
            plank = create_box(f"plank_{i}", (pw, 0.02, 0.012), (rx, ry, rz), palette['board'], group)
            plank.rotation_euler = (0, 0, random.random() * math.pi)
        elif rtype < 0.8:
            rh = 0.08 + random.random() * 0.12
            rebar = create_cylinder(f"rebar_base_{i}", 0.005, rh, (rx, ry, rz + rh/2), palette['rebar'], 4, group)
            rebar.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(0, math.pi))
        else:
            # Small vegetation
            vw = 0.06 + random.random() * 0.1
            create_box(f"base_veg_{i}", (vw, vw*0.7, 0.015), (rx, ry, 0.015), palette['veg'], group)

    # Bigger rubble pile near one corner
    for ri in range(random.randint(3, 6)):
        cx = bw * 0.4 * (random.choice([-1, 1]))
        cy = bd/2 * (random.choice([-1, 1]))
        rx = cx + random.uniform(-0.4, 0.4)
        ry = cy + random.uniform(-0.3, 0.3)
        rs = 0.04 + random.random() * 0.07
        bpy.ops.mesh.primitive_ico_sphere_add(radius=rs, subdivisions=1, location=(rx, ry, 0.03))
        obj = bpy.context.active_object
        obj.name = f"corner_rubble_{ri}"
        obj.scale = (1+random.random()*0.4, 1+random.random()*0.3, 0.4+random.random()*0.3)
        bpy.ops.object.transform_apply(scale=True)
        obj.data.materials.append(random.choice([palette['wall'], palette['rubble']]))


def build_building(bw, bd, h, palette_fn, hole_chance=0.25):
    """Build a complete post-apocalyptic building."""
    clear_scene()
    set_units()
    palette = palette_fn()
    g = bpy.data.collections.new("Building")
    bpy.context.scene.collection.children.link(g)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[g.name]

    stories = max(1, int(h / 1.0))

    # Ground floor
    create_box("ground_floor", (bw - 0.36, bd - 0.36, 0.1), (0, 0, 0.05), palette['trim'], g)

    # Solid exterior walls (ground to roof, ONE piece per side)
    build_solid_walls(bw, bd, h, palette['wall'], g, hole_chance)

    # Interior floor slabs (not visible from outside, but adds detail)
    build_interior_floors(bw, bd, stories, palette['trim'], g)

    # Windows on all walls
    build_wall_windows(bw, bd, h, palette, g)
    build_east_west_windows(bw, bd, h, palette, g)

    # Facade details
    build_facade_details(bw, bd, h, palette, g)

    # Roof assembly
    build_roof_assembly(bw, bd, h, palette, g)
    build_roof_details(bw, bd, h, palette, g)

    # Rubble at base
    build_rubble_base(bw, bd, palette, g)

    return g


def merge_building_mesh(collection):
    """Join all meshes into one."""
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in collection.objects if o.type == 'MESH']
    if not meshes:
        return
    bpy.context.view_layer.objects.active = meshes[0]
    meshes[0].select_set(True)
    for m in meshes[1:]:
        m.select_set(True)
    bpy.ops.object.join()
    bpy.context.active_object.name = "BuildingMesh"


def export_building(name, bw, bd, h, palette_fn, hole_chance=0.25):
    print(f"\n=== Generating {name} ({bw}x{bd}, h={h}) ===")
    g = build_building(bw, bd, h, palette_fn, hole_chance)
    merge_building_mesh(g)
    path = os.path.join(OUTPUT_DIR, f"{name}.glb")
    export_glb(path)
    print(f"Exported: {path}")
    return path


def main():
    print("=== Post-Apocalyptic Building Generator ===")
    print(f"Output: {OUTPUT_DIR}")

    paths = []

    # 1. Top-left: Concrete (8.8 x 5.4, h=8.0, heavy damage)
    paths.append(export_building(
        "building_top_left", 8.8, 5.4, 8.0,
        make_concrete_palette, hole_chance=0.35,
    ))

    # 2. Top-center: Brick (9.4 x 5.4, h=9.0)
    paths.append(export_building(
        "building_top_center", 9.4, 5.4, 9.0,
        make_brick_palette, hole_chance=0.30,
    ))

    # 3. Top-right: Slate/steel (10.0 x 5.4, h=8.0, gutted)
    paths.append(export_building(
        "building_top_right", 10.0, 5.4, 8.0,
        make_slate_palette, hole_chance=0.45,
    ))

    # 4. Mid-right: Slate (10.0 x 5.4, h=9.0)
    paths.append(export_building(
        "building_mid_right", 10.0, 5.4, 9.0,
        make_slate_palette, hole_chance=0.30,
    ))

    # 5. Bottom-right: Wood/industrial (10.0 x 4.0, h=7.0)
    paths.append(export_building(
        "building_bottom_right", 10.0, 4.0, 7.0,
        make_wood_palette, hole_chance=0.35,
    ))

    print(f"\n=== Done! Generated {len(paths)} buildings ===")
    for p in paths:
        print(f"  {p}")


if __name__ == "__main__":
    main()

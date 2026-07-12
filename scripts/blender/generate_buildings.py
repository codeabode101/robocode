"""
Post-apocalyptic building generator — actual architecture.

Buildings are 2.5 units tall so the camera (Z=2.2, ~45° down) sees:
- The ROOF with detail (vents, tanks, vegetation, collapse)
- The WALLS with visible windows, doors, balconies, fire escapes
- The BASE with rubble and vegetation

Architectural features are OVERSIZED relative to the walls so they're
visible at the game's camera distance. Each building is unique.

Run: blender --background --python scripts/blender/generate_buildings.py
"""
import bpy
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils import (
    clear_scene, set_units, mat, create_box, create_cylinder,
    cut_hole, export_glb,
    make_concrete_palette, make_brick_palette, make_slate_palette, make_wood_palette,
)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models')
os.makedirs(OUTPUT_DIR, exist_ok=True)

random.seed(42)

BLACK = mat("black_void", (0.02, 0.02, 0.03), 0.95)
STAIN = mat("wall_stain", (0.08, 0.08, 0.08), 0.95)
WATER = mat("water", (0.12, 0.22, 0.35), 0.15, 0.1)
RED_TIP = mat("red_tip", (0.8, 0.1, 0.1), 0.5, 0.0)
GRAFFITI = [
    mat("g_red", (0.86, 0.15, 0.15), 0.9),
    mat("g_blue", (0.15, 0.39, 0.92), 0.9),
    mat("g_green", (0.09, 0.64, 0.29), 0.9),
    mat("g_yellow", (0.96, 0.62, 0.04), 0.9),
]


def shell(bw, bd, h, wall_mat, g):
    """4 solid walls — thick, with cornice/ledge detail."""
    t = 0.2  # Wall thickness
    wh = h - 0.2

    for side in ['south', 'north', 'east', 'west']:
        if side == 'south':
            w = create_box("ws", (bw, t, wh), (0, -bd/2, wh/2), wall_mat, g)
        elif side == 'north':
            w = create_box("wn", (bw, t, wh), (0, bd/2, wh/2), wall_mat, g)
        elif side == 'east':
            w = create_box("we", (t, bd, wh), (bw/2, 0, wh/2), wall_mat, g)
        else:
            w = create_box("ww", (t, bd, wh), (-bw/2, 0, wh/2), wall_mat, g)

    # Horizontal cornice bands at mid-height and near roof
    for z in [h * 0.45, h * 0.85]:
        for side in ['south', 'north']:
            sy = bd/2 * (1 if side == 'north' else -1)
            create_box(f"cornice_{side}_{z:.0f}", (bw + 0.06, 0.06, 0.06),
                       (0, sy, z), wall_mat, g)
        for side in ['east', 'west']:
            sx = bw/2 * (1 if side == 'east' else -1)
            create_box(f"cornice_{side}_{z:.0f}", (0.06, bd + 0.06, 0.06),
                       (sx, 0, z), wall_mat, g)


def ground_floor(bw, bd, trim_mat, g):
    create_box("floor", (bw - 0.4, bd - 0.4, 0.1), (0, 0, 0.05), trim_mat, g)


def roof_slab(bw, bd, h, trim_mat, g):
    create_box("roof", (bw + 0.12, bd + 0.12, 0.15), (0, 0, h - 0.075), trim_mat, g)
    # Parapet
    ph = 0.22
    pt = 0.08
    for side in ['south', 'north', 'east', 'west']:
        if side == 'south':
            create_box("ps", (bw + 0.12, pt, ph), (0, -bd/2, h + ph/2), trim_mat, g)
        elif side == 'north':
            create_box("pn", (bw + 0.12, pt, ph), (0, bd/2, h + ph/2), trim_mat, g)
        elif side == 'east':
            create_box("pe", (pt, bd + 0.12, ph), (bw/2, 0, h + ph/2), trim_mat, g)
        else:
            create_box("pw", (pt, bd + 0.12, ph), (-bw/2, 0, h + ph/2), trim_mat, g)


def windows_south_north(bw, bd, h, glass_mat, board_mat, trim_mat, g):
    """Visible windows on south+north — large enough to see."""
    count = max(2, int(bw / 0.9))
    spacing = bw / count
    win_w = 0.35
    win_h = 0.45

    for i in range(count):
        wx = -bw/2 + spacing * (i + 0.5)
        state = random.random()

        for side_sign in [-1, 1]:
            sy = side_sign * (bd/2 + 0.025)
            wz = h * 0.5

            if state < 0.2:
                # Boarded window — prominent planks
                create_box(f"b_{i}_{side_sign}", (win_w + 0.06, 0.04, win_h + 0.06),
                           (wx, sy, wz), board_mat, g)
                # X-shaped boards
                create_box(f"bx_{i}_{side_sign}", (win_w + 0.1, 0.03, 0.03),
                           (wx, sy + side_sign * 0.02, wz), wall_mat_g, g)
                create_box(f"by_{i}_{side_sign}", (0.03, 0.03, win_h + 0.1),
                           (wx, sy + side_sign * 0.02, wz), wall_mat_g, g)
            elif state < 0.45:
                # Window with frame + dark glass
                create_box(f"g_{i}_{side_sign}", (win_w, 0.025, win_h),
                           (wx, sy, wz), glass_mat, g)
                # Frame
                for fw, fp in [(win_w + 0.06, (0, win_h/2)), (-win_w - 0.06, (-0, -win_h/2)),
                               (win_w + 0.06, (0, -win_h/2)), (-win_w - 0.06, (0, win_h/2))]:
                    pass
                # Top frame
                create_box(f"ft_{i}_{side_sign}", (win_w + 0.08, 0.03, 0.03),
                           (wx, sy + side_sign * 0.015, wz + win_h/2), trim_mat, g)
                # Bottom sill
                create_box(f"fb_{i}_{side_sign}", (win_w + 0.1, 0.04, 0.03),
                           (wx, sy + side_sign * 0.02, wz - win_h/2), trim_mat, g)
                # Sides
                create_box(f"fl_{i}_{side_sign}", (0.03, 0.03, win_h),
                           (wx - win_w/2 - 0.015, sy + side_sign * 0.015, wz), trim_mat, g)
                create_box(f"fr_{i}_{side_sign}", (0.03, 0.03, win_h),
                           (wx + win_w/2 + 0.015, sy + side_sign * 0.015, wz), trim_mat, g)
            elif state < 0.65:
                # Broken glass with jagged shard
                create_box(f"bg_{i}_{side_sign}", (win_w * 0.6, 0.02, win_h * 0.5),
                           (wx, sy, wz - 0.05), glass_mat, g)
                shard = create_box(f"sh_{i}_{side_sign}", (0.08, 0.02, 0.14),
                                   (wx + win_w*0.3, sy + side_sign * 0.04, wz - 0.1),
                                   glass_mat, g)
                shard.rotation_euler = (0, 0, random.uniform(-0.6, 0.6))
            elif state < 0.82:
                # Dark open hole
                create_box(f"dh_{i}_{side_sign}", (win_w, 0.08, win_h),
                           (wx, sy - side_sign * 0.01, wz), BLACK, g)
            # else: solid wall section


def windows_east_west(bw, bd, h, glass_mat, board_mat, trim_mat, g):
    """Fewer windows on east/west walls."""
    count = max(1, int(bd / 1.2))
    spacing = bd / count
    win_w = 0.28
    win_h = 0.38

    for i in range(count):
        wy = -bd/2 + spacing * (i + 0.5)
        state = random.random()

        for side_sign in [-1, 1]:
            sx = side_sign * (bw/2 + 0.025)
            wz = h * 0.5

            if state < 0.25:
                create_box(f"ew_b_{i}_{side_sign}", (0.04, win_w + 0.06, win_h + 0.06),
                           (sx, wy, wz), board_mat, g)
            elif state < 0.55:
                create_box(f"ew_g_{i}_{side_sign}", (0.025, win_w, win_h),
                           (sx, wy, wz), glass_mat, g)
                create_box(f"ew_ft_{i}_{side_sign}", (0.03, win_w + 0.06, 0.03),
                           (sx + side_sign * 0.015, wy, wz + win_h/2), trim_mat, g)
                create_box(f"ew_fb_{i}_{side_sign}", (0.04, win_w + 0.08, 0.03),
                           (sx + side_sign * 0.02, wy, wz - win_h/2), trim_mat, g)
            elif state < 0.78:
                create_box(f"ew_dh_{i}_{side_sign}", (0.08, win_w, win_h),
                           (sx - side_sign * 0.01, wy, wz), BLACK, g)


def door(bw, bd, h, glass_mat, trim_mat, g):
    """Ground-floor door on south wall."""
    dw = 0.35
    dh = 0.55
    dx = bw * 0.2 * (random.choice([-1, 1]))
    dy = -bd/2 - 0.025

    # Door frame
    create_box("door_frame_l", (0.04, 0.04, dh + 0.04),
               (dx - dw/2 - 0.02, dy, dh/2), trim_mat, g)
    create_box("door_frame_r", (0.04, 0.04, dh + 0.04),
               (dx + dw/2 + 0.02, dy, dh/2), trim_mat, g)
    create_box("door_frame_t", (dw + 0.08, 0.04, 0.04),
               (dx, dy, dh + 0.02), trim_mat, g)
    # Dark interior
    create_box("door_dark", (dw, 0.08, dh), (dx, dy - 0.01, dh/2), BLACK, g)
    # Step
    create_box("door_step", (dw + 0.12, 0.08, 0.04), (dx, dy - 0.06, 0.02), trim_mat, g)


def fire_escape(bw, bd, h, steel_mat, g):
    """Metal fire escape — one side, 2 platforms."""
    side = random.choice([-1, 1])
    fe_x = bw * 0.35 * (random.choice([-1, 1]))

    for fi, fz in enumerate([h * 0.4, h * 0.75]):
        # Platform
        create_box(f"fe_plat_{fi}", (0.6, 0.45, 0.035),
                   (fe_x, side * (bd/2 + 0.22), fz), steel_mat, g)
        # Bracket
        create_box(f"fe_brk_{fi}", (0.04, 0.35, 0.04),
                   (fe_x, side * (bd/2 + 0.1), fz - 0.06), steel_mat, g)
        # Railing
        create_box(f"fe_rail_{fi}", (0.6, 0.025, 0.2),
                   (fe_x, side * (bd/2 + 0.42), fz + 0.1), steel_mat, g)
        for rx in [-0.25, 0.25]:
            create_box(f"fe_post_{fi}_{rx:.1f}", (0.025, 0.025, 0.2),
                       (fe_x + rx, side * (bd/2 + 0.42), fz + 0.1), steel_mat, g)

    # Ladder connecting platforms
    ladder_h = h * 0.75 - h * 0.4
    create_box("fe_ladder", (0.04, 0.04, ladder_h),
               (fe_x + 0.3, side * (bd/2 + 0.35), h * 0.4 + ladder_h/2), steel_mat, g)
    # Side rails
    for lr in [-0.025, 0.025]:
        create_box(f"fe_lrail_{lr:.2f}", (0.015, 0.015, ladder_h),
                   (fe_x + 0.3 + lr, side * (bd/2 + 0.35), h * 0.4 + ladder_h/2), steel_mat, g)


def balconies(bw, bd, h, accent_mat, steel_mat, g):
    """Balconies with railings — one or two per building."""
    side = random.choice([-1, 1])
    for bi, bz in enumerate([h * 0.35, h * 0.7]):
        if random.random() > 0.6:
            continue
        balc_w = 0.6 + random.random() * 0.4
        bx = (random.random() - 0.5) * (bw - balc_w - 0.4)
        # Slab
        create_box(f"balc_{bi}", (balc_w, 0.4, 0.06),
                   (bx, side * (bd/2 + 0.2), bz), accent_mat, g)
        # Railing
        create_box(f"balc_rail_{bi}", (balc_w, 0.025, 0.18),
                   (bx, side * (bd/2 + 0.38), bz + 0.09), steel_mat, g)
        for px in [-balc_w/2, balc_w/2]:
            create_box(f"balc_post_{bi}_{px:.1f}", (0.025, 0.025, 0.18),
                       (bx + px, side * (bd/2 + 0.38), bz + 0.09), steel_mat, g)


def roof_details(bw, bd, h, palette, g):
    """Rich roof detail — visible from camera above."""
    top = h + 0.08

    # Water tank
    if random.random() > 0.15:
        tx = bw * 0.25 * (random.choice([-1, 1]))
        ty = bd * 0.25 * (random.choice([-1, 1]))
        create_cylinder("tank", 0.22, 0.35, (tx, ty, top + 0.18), palette['steel'], 10, g)
        create_cylinder("tank_cap", 0.16, 0.06, (tx, ty, top + 0.38), palette['accent'], 10, g)
        for lx, ly in [(-0.12, -0.12), (0.12, -0.12), (-0.12, 0.12), (0.12, 0.12)]:
            create_cylinder("tleg", 0.015, 0.14, (tx+lx, ty+ly, top + 0.07), palette['steel'], 4, g)

    # Roof access shed
    sw = 0.35 + random.random() * 0.25
    sd = sw * (0.6 + random.random() * 0.3)
    sx = (random.random() - 0.5) * bw * 0.3
    sy = (random.random() - 0.5) * bd * 0.3
    sh = 0.28 + random.random() * 0.12
    create_box("shed", (sw, sd, sh), (sx, sy, top + sh/2 + 0.04), palette['wall'], g)
    create_box("shed_door", (sw*0.3, 0.03, sh*0.65),
               (sx, sy + sd/2 + 0.02, top + sh*0.32 + 0.04), palette['accent'], g)

    # AC units / vents
    for vi in range(random.randint(2, 4)):
        vx = bw * 0.35 * (random.random() - 0.5)
        vy = bd * 0.35 * (random.random() - 0.5)
        vw = 0.12 + random.random() * 0.1
        vh = 0.06 + random.random() * 0.06
        create_box(f"vent_{vi}", (vw, vw, vh), (vx, vy, top + vh/2 + 0.04), palette['steel'], g)
        create_box(f"vgrate_{vi}", (vw*0.8, vw*0.8, 0.01),
                   (vx, vy, top + vh + 0.05), palette['glass'], g)

    # Satellite dish
    if random.random() > 0.45:
        dx = bw * 0.3 * (random.choice([-1, 1]))
        dy = bd * 0.3 * (random.choice([-1, 1]))
        create_cylinder("dish", 0.18, 0.03, (dx, dy, top + 0.16), palette['steel'], 10, g)
        create_cylinder("dpole", 0.012, 0.14, (dx, dy, top + 0.08), palette['steel'], 4, g)

    # Antenna
    if random.random() > 0.4:
        ax = bw * 0.35 * (random.choice([-1, 1]))
        ay = bd * 0.35 * (random.choice([-1, 1]))
        ah = 0.35 + random.random() * 0.25
        ant = create_cylinder("ant", 0.012, ah, (ax, ay, top + ah/2 + 0.04), palette['steel'], 4, g)
        ant.rotation_euler = (0, 0, random.uniform(-0.12, 0.12))
        create_cylinder("atip", 0.022, 0.035, (ax, ay, top + ah + 0.06), RED_TIP, 6, g)

    # Vegetation
    for vi in range(random.randint(3, 6)):
        vw = 0.2 + random.random() * 0.5
        vd = 0.15 + random.random() * 0.35
        vx = (random.random() - 0.5) * bw * 0.7
        vy = (random.random() - 0.5) * bd * 0.7
        create_box(f"veg_{vi}", (vw, vd, 0.02), (vx, vy, top + 0.04), palette['veg'], g)

    # Puddles
    for pi in range(random.randint(1, 3)):
        pr = 0.12 + random.random() * 0.18
        px = (random.random() - 0.5) * bw * 0.5
        py = (random.random() - 0.5) * bd * 0.5
        create_cylinder(f"pud_{pi}", pr, 0.008, (px, py, top + 0.04), WATER, 8, g)

    # Collapsed section
    if random.random() > 0.4:
        cw = 0.6 + random.random() * 0.7
        cd = 0.5 + random.random() * 0.5
        cx = bw * 0.3 * (random.choice([-1, 1]))
        cy = bd * 0.3 * (random.choice([-1, 1]))
        create_box("collapse", (cw, cd, 0.16), (cx, cy, top + 0.01), BLACK, g)
        for ri in range(5):
            rx = cx + (random.random() - 0.5) * cw * 1.3
            ry = cy + (random.random() - 0.5) * cd * 1.3
            rs = 0.04 + random.random() * 0.07
            bpy.ops.mesh.primitive_ico_sphere_add(radius=rs, subdivisions=1, location=(rx, ry, top + 0.04))
            o = bpy.context.active_object
            o.name = f"cr_{ri}"
            o.scale = (1+random.random()*0.5, 1+random.random()*0.3, 0.4+random.random()*0.3)
            bpy.ops.object.transform_apply(scale=True)
            o.data.materials.append(random.choice([palette['wall'], palette['rubble']]))

    # Rebar sticking up
    for ri in range(random.randint(3, 6)):
        rx = bw * 0.45 * (random.random() - 0.5)
        ry = bd/2 * (random.choice([-1, 1]))
        rh = 0.1 + random.random() * 0.18
        rb = create_cylinder(f"rb_{ri}", 0.008, rh, (rx, ry, top + rh/2 + 0.02), palette['rebar'], 4, g)
        rb.rotation_euler = (random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), 0)


def facade(bw, bd, h, palette, g):
    """Pipes, stains, graffiti, signs, AC on walls."""
    # Drainpipe
    px = bw * 0.4 * (random.choice([-1, 1]))
    ph = h * 0.65
    pipe = create_cylinder("pipe", 0.03, ph, (px, bd/2 + 0.04, ph/2), palette['steel'], 6, g)
    for j in range(3):
        create_cylinder(f"clamp_{j}", 0.04, 0.03, (px, bd/2 + 0.04, 0.25 + j * ph/3), palette['steel'], 6, g)

    # Stains
    for si in range(random.randint(3, 6)):
        sh = 0.2 + random.random() * 0.35
        sx = (random.random() - 0.5) * bw * 0.6
        ss = random.choice([-1, 1])
        sy = ss * (bd/2 + 0.015)
        sz = 0.15 + random.random() * (h * 0.6)
        create_box(f"st_{si}", (0.05 + random.random()*0.06, 0.012, sh), (sx, sy, sz), STAIN, g)

    # Graffiti
    for gi in range(random.randint(2, 4)):
        gm = random.choice(GRAFFITI)
        gw = 0.25 + random.random() * 0.4
        gh = 0.2 + random.random() * 0.3
        gs = random.choice([-1, 1])
        gx = (random.random() - 0.5) * bw * 0.5
        gy = gs * (bd/2 + 0.015)
        gz = 0.3 + random.random() * (h * 0.4)
        create_box(f"gr_{gi}", (gw, 0.012, gh), (gx, gy, gz), gm, g)

    # Sign board
    if random.random() > 0.3:
        sw = 0.6 + random.random() * 0.6
        ss = random.choice([-1, 1])
        sx = (random.random() - 0.5) * (bw - sw - 0.4)
        sy = ss * (bd/2 + 0.05)
        sz = h * 0.58
        create_box("sign", (sw, 0.03, 0.14), (sx, sy, sz), palette['board'], g)
        for rx in [-sw/3, sw/3]:
            create_box(f"sbr_{rx:.1f}", (0.02, 0.1, 0.02), (sx + rx, sy + ss*0.05, sz + 0.07), palette['steel'], g)

    # Awning
    if random.random() > 0.45:
        aw = 0.7 + random.random() * 0.5
        as_ = random.choice([-1, 1])
        ax = (random.random() - 0.5) * (bw - aw - 0.3)
        ay = as_ * bd/2
        az = h * 0.42
        create_box("awning", (aw, 0.32, 0.035), (ax, ay + as_*0.16, az), palette['board'], g)
        for rx in [-aw/3, aw/3]:
            create_box(f"arod_{rx:.1f}", (0.015, 0.015, 0.22),
                       (ax + rx, ay + as_*0.06, az - 0.11), palette['steel'], g)

    # AC box on wall
    if random.random() > 0.45:
        acs = random.choice([-1, 1])
        acx = (random.random() - 0.5) * bw * 0.5
        acy = acs * (bd/2 + 0.14)
        acz = h * 0.32
        create_box("ac", (0.28, 0.2, 0.18), (acx, acy, acz), palette['steel'], g)
        create_box("ac_fan", (0.14, 0.02, 0.14), (acx, acy + acs*0.1, acz), palette['glass'], g)


def rubble(bw, bd, palette, g):
    """Rubble at base — spheres, planks, rebar, vegetation."""
    for i in range(random.randint(8, 16)):
        side = random.choice([-1, 1])
        rx = bw * 0.5 * (random.random() - 0.5)
        ry = side * (bd/2 + 0.06 + random.random() * 0.3)
        rz = 0.02 + random.random() * 0.02
        rt = random.random()
        if rt < 0.35:
            rs = 0.03 + random.random() * 0.06
            bpy.ops.mesh.primitive_ico_sphere_add(radius=rs, subdivisions=1, location=(rx, ry, rz))
            o = bpy.context.active_object
            o.name = f"rb_{i}"
            o.scale = (1+random.random()*0.5, 1+random.random()*0.3, 0.5+random.random()*0.4)
            bpy.ops.object.transform_apply(scale=True)
            o.data.materials.append(random.choice([palette['wall'], palette['rubble'], palette['trim']]))
        elif rt < 0.6:
            pw = 0.1 + random.random() * 0.2
            pl = create_box(f"pl_{i}", (pw, 0.025, 0.015), (rx, ry, rz), palette['board'], g)
            pl.rotation_euler = (0, 0, random.random() * math.pi)
        elif rt < 0.8:
            rh = 0.08 + random.random() * 0.14
            rb = create_cylinder(f"rb_{i}", 0.006, rh, (rx, ry, rz + rh/2), palette['rebar'], 4, g)
            rb.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(0, math.pi))
        else:
            vw = 0.06 + random.random() * 0.1
            create_box(f"veg_{i}", (vw, vw*0.7, 0.015), (rx, ry, 0.015), palette['veg'], g)


def build_building(bw, bd, h, palette_fn):
    clear_scene()
    set_units()
    palette = palette_fn()
    g = bpy.data.collections.new("Building")
    bpy.context.scene.collection.children.link(g)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[g.name]

    # Make wall_mat accessible to window builder
    global wall_mat_g
    wall_mat_g = palette['wall']

    ground_floor(bw, bd, palette['trim'], g)
    shell(bw, bd, h, palette['wall'], g)
    windows_south_north(bw, bd, h, palette['glass'], palette['board'], palette['trim'], g)
    windows_east_west(bw, bd, h, palette['glass'], palette['board'], palette['trim'], g)
    door(bw, bd, h, palette['glass'], palette['trim'], g)
    fire_escape(bw, bd, h, palette['steel'], g)
    balconies(bw, bd, h, palette['accent'], palette['steel'], g)
    roof_slab(bw, bd, h, palette['trim'], g)
    roof_details(bw, bd, h, palette, g)
    facade(bw, bd, h, palette, g)
    rubble(bw, bd, palette, g)

    return g


def merge_building_mesh(collection):
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


def export_building(name, bw, bd, h, palette_fn):
    print(f"\n=== {name} ({bw}x{bd}, h={h}) ===")
    g = build_building(bw, bd, h, palette_fn)
    merge_building_mesh(g)
    path = os.path.join(OUTPUT_DIR, f"{name}.glb")
    export_glb(path)
    print(f"  -> {path}")
    return path


def main():
    print("=== Abandoned Building Generator v3 ===")
    paths = []

    # Buildings are h=2.5 so camera (Z=2.2) sees roof + walls
    # Width/depth fill the grass blocks
    # Hole_chance controls how many window openings vs solid walls

    paths.append(export_building("building_top_left", 8.8, 5.4, 2.5, make_concrete_palette))
    paths.append(export_building("building_top_center", 9.4, 5.4, 2.5, make_brick_palette))
    paths.append(export_building("building_top_right", 10.0, 5.4, 2.5, make_slate_palette))
    paths.append(export_building("building_mid_right", 10.0, 5.4, 2.5, make_slate_palette))
    paths.append(export_building("building_bottom_right", 10.0, 4.0, 2.5, make_wood_palette))

    print(f"\n=== Done: {len(paths)} buildings ===")


if __name__ == "__main__":
    main()

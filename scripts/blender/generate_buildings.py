"""
Master building generator — creates all 5 abandoned buildings as GLB models.
Run: blender --background --python scripts/blender/generate_buildings.py
"""
import bpy
import bmesh
import math
import random
import sys
import os

# Add scripts dir to path for utils import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils import (
    clear_scene, set_units, mat, create_box, create_cylinder,
    cut_hole, scatter_debris, export_glb,
    PALETTES, make_concrete_palette, make_brick_palette, make_slate_palette, make_wood_palette,
)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models')
os.makedirs(OUTPUT_DIR, exist_ok=True)

random.seed(42)  # Reproducible


def build_floor_slab(group, bw, bd, z, material, shrink=1.0):
    """Single floor slab."""
    return create_box("floor_slab", (bw*shrink, bd, 0.08), (0, 0, z), material, group)


def build_wall(group, bw, bd, z, h, material, side='south'):
    """Single wall segment."""
    thickness = 0.12
    if side == 'south':
        return create_box(f"wall_s_{z:.1f}", (bw, thickness, h), (0, -bd/2, z + h/2), material, group)
    elif side == 'north':
        return create_box(f"wall_n_{z:.1f}", (bw, thickness, h), (0, bd/2, z + h/2), material, group)
    elif side == 'east':
        return create_box(f"wall_e_{z:.1f}", (thickness, bd, h), (bw/2, 0, z + h/2), material, group)
    elif side == 'west':
        return create_box(f"wall_w_{z:.1f}", (thickness, bd, h), (-bw/2, 0, z + h/2), material, group)


def build_walls_with_holes(group, bw, bd, z, h, wall_mat, hole_mat, hole_chance=0.25):
    """Build 4 walls with random holes cut into them."""
    walls = []
    for side in ['south', 'north', 'east', 'west']:
        w = build_wall(group, bw, bd, z, h, wall_mat, side)
        # Cut wall holes
        if random.random() < hole_chance:
            hole_w = 0.3 + random.random() * 0.6
            hole_h = 0.4 + random.random() * 0.5
            if side in ('south', 'north'):
                hx = (random.random() - 0.5) * (bw - hole_w - 0.3)
                hy = bd/2 * (1 if side == 'north' else -1)
                hole_loc = (hx, hy, z + h * 0.4)
            else:
                hy = (random.random() - 0.5) * (bd - hole_w - 0.3)
                hx = bw/2 * (1 if side == 'east' else -1)
                hole_loc = (hx, hy, z + h * 0.4)
            cut_hole(w, (hole_w, 0.2, hole_h), hole_loc)
            # Dark interior behind hole
            create_box("hole_dark", (hole_w - 0.02, 0.05, hole_h - 0.02),
                       (hole_loc[0], hole_loc[1], hole_loc[2]), hole_mat, group)
        walls.append(w)
    return walls


def build_window_row(group, bw, bd, z, wall_mat, glass_mat, board_mat, win_h=0.35, win_w=0.2):
    """Row of windows on south+north walls with varied states."""
    count = max(2, int(bw / 0.8))
    spacing = bw / count
    for i in range(count):
        wx = -bw/2 + spacing * (i + 0.5)
        state = random.random()
        for side_sign in [-1, 1]:
            sy = side_sign * bd/2
            if state < 0.25:
                # Boarded window
                create_box(f"board_{i}", (win_w + 0.02, 0.03, win_h + 0.02),
                           (wx, sy + side_sign * 0.02, z + 0.5), board_mat, group)
                # Cross boards
                create_box(f"board_x_{i}", (win_w + 0.06, 0.02, 0.025),
                           (wx, sy + side_sign * 0.025, z + 0.5), wall_mat, group)
                create_box(f"board_y_{i}", (0.025, 0.02, win_h + 0.06),
                           (wx, sy + side_sign * 0.025, z + 0.5), wall_mat, group)
            elif state < 0.5:
                # Broken window — dark hole with glass shard
                create_box(f"window_hole_{i}", (win_w, 0.03, win_h),
                           (wx, sy + side_sign * 0.01, z + 0.5), glass_mat, group)
                # Jagged glass shard hanging
                create_box(f"glass_shard_{i}", (0.06, 0.02, 0.12),
                           (wx + 0.08, sy + side_sign * 0.03, z + 0.35), glass_mat, group)
            elif state < 0.75:
                # Dark window with frame
                create_box(f"window_dark_{i}", (win_w, 0.03, win_h),
                           (wx, sy + side_sign * 0.01, z + 0.5), glass_mat, group)
                # Frame top and bottom
                create_box(f"frame_t_{i}", (win_w + 0.04, 0.025, 0.025),
                           (wx, sy + side_sign * 0.02, z + 0.5 + win_h/2), wall_mat, group)
                create_box(f"frame_b_{i}", (win_w + 0.04, 0.025, 0.025),
                           (wx, sy + side_sign * 0.02, z + 0.5 - win_h/2), wall_mat, group)
            else:
                # Open broken window with jagged edge
                create_box(f"window_open_{i}", (win_w, 0.03, win_h),
                           (wx, sy + side_sign * 0.01, z + 0.5), glass_mat, group)
                # Jagged glass piece at angle
                shard = create_box(f"glass_jag_{i}", (0.04, 0.015, 0.08),
                                   (wx - 0.06, sy + side_sign * 0.04, z + 0.3), glass_mat, group)
                shard.rotation_euler = (0, 0, 0.4 * random.choice([-1, 1]))


def build_fire_escape(group, bw, bd, stories, z_base, steel_mat):
    """Metal fire escape on one side."""
    side = random.choice([-1, 1])
    fe_x = bw * 0.4 * random.choice([-1, 1])
    for f in range(1, min(stories, 6)):
        fz = z_base + f * 1.0 + 0.1
        # Platform
        create_box(f"fe_plat_{f}", (0.5, 0.4, 0.03),
                   (fe_x, side * (bd/2 + 0.2), fz), steel_mat, group)
        # Support bracket underneath
        create_box(f"fe_bracket_{f}", (0.04, 0.3, 0.04),
                   (fe_x, side * (bd/2 + 0.1), fz - 0.05), steel_mat, group)
        # Diagonal brace
        brace = create_box(f"fe_brace_{f}", (0.03, 0.35, 0.03),
                           (fe_x, side * (bd/2 + 0.15), fz - 0.15), steel_mat, group)
        brace.rotation_euler = (0.3 * (1 if side > 0 else -1), 0, 0)
        # Railing (sometimes broken)
        if random.random() > 0.3:
            create_box(f"fe_rail_{f}", (0.5, 0.02, 0.18),
                       (fe_x, side * (bd/2 + 0.38), fz + 0.09), steel_mat, group)
            for rx in [-0.2, 0.2]:
                create_box(f"fe_post_{f}_{rx}", (0.02, 0.02, 0.18),
                           (fe_x + rx, side * (bd/2 + 0.38), fz + 0.09), steel_mat, group)
        # Stairs to next platform
        if f < stories - 1 and random.random() > 0.25:
            stair = create_box(f"fe_stair_{f}", (0.04, 0.3, 0.7),
                               (fe_x + 0.3 * (1 if f % 2 == 0 else -1), side * (bd/2 + 0.15), fz + 0.45), steel_mat, group)
            stair.rotation_euler = (0, 0, 0.5 * (1 if f % 2 == 0 else -1))


def build_balconies(group, bw, bd, stories, z_base, accent_mat, steel_mat):
    """Balconies with support brackets."""
    side = random.choice([-1, 1])
    for f in range(2, stories, 2):
        if random.random() > 0.5:
            continue
        bz = z_base + f * 1.0
        balc_w = 0.5 + random.random() * 0.4
        bx = (random.random() - 0.5) * (bw - balc_w - 0.3)
        # Slab
        create_box(f"balc_slab_{f}", (balc_w, 0.4, 0.06),
                   (bx, side * (bd/2 + 0.2), bz), accent_mat, group)
        # Support bracket underneath (triangular feel via two pieces)
        create_box(f"balc_bracket_l_{f}", (0.04, 0.35, 0.04),
                   (bx - balc_w/3, side * (bd/2 + 0.1), bz - 0.08), steel_mat, group)
        create_box(f"balc_bracket_r_{f}", (0.04, 0.35, 0.04),
                   (bx + balc_w/3, side * (bd/2 + 0.1), bz - 0.08), steel_mat, group)
        # Railing
        if random.random() > 0.3:
            create_box(f"balc_rail_{f}", (balc_w, 0.02, 0.15),
                       (bx, side * (bd/2 + 0.38), bz + 0.08), steel_mat, group)
            for px in [-balc_w/2, balc_w/2]:
                create_box(f"balc_post_{f}_{px:.1f}", (0.02, 0.02, 0.15),
                           (bx + px, side * (bd/2 + 0.38), bz + 0.08), steel_mat, group)
        else:
            # Broken railing — half missing
            create_box(f"balc_rail_broken_{f}", (balc_w * 0.4, 0.02, 0.15),
                       (bx - balc_w * 0.2, side * (bd/2 + 0.38), bz + 0.08), steel_mat, group)


def build_roof_details(group, bw, bd, top_z, palette):
    """Water tank, vents, antenna, vegetation, puddles."""
    # Water tank
    if random.random() > 0.2:
        tx = bw * 0.25
        ty = -bd * 0.2
        create_cylinder("tank_body", 0.18, 0.35, (tx, ty, top_z + 0.18), palette['steel'], 8, group)
        create_cylinder("tank_cap", 0.12, 0.08, (tx, ty, top_z + 0.39), palette['accent'], 8, group)
        for tl in [-1, 1]:
            create_cylinder(f"tank_leg_{tl}", 0.02, 0.2, (tx + tl*0.1, ty, top_z + 0.08), palette['steel'], 4, group)

    # Roof access box
    if random.random() > 0.4:
        raw = 0.35 + random.random() * 0.25
        create_box("roof_access", (raw, raw*0.7, 0.3),
                   (-bw*0.2, bd*0.25, top_z + 0.15), palette['wall'], group)
        create_box("roof_access_door", (0.15, 0.03, 0.22),
                   (-bw*0.2, bd*0.25 + raw*0.35 + 0.02, top_z + 0.11), palette['accent'], group)

    # Vents
    for vi in range(2):
        if random.random() > 0.5:
            continue
        vx = -bw*0.35 + vi * bw*0.3
        vy = -bd*0.35
        create_box(f"vent_{vi}", (0.15, 0.15, 0.12), (vx, vy, top_z + 0.06), palette['steel'], group)
        create_box(f"vent_grate_{vi}", (0.12, 0.12, 0.01), (vx, vy, top_z + 0.13), palette['glass'], group)

    # Satellite dish
    if random.random() > 0.5:
        create_cylinder("dish", 0.18, 0.04, (bw*0.1, bd*0.15, top_z + 0.18), palette['steel'], 8, group)
        create_cylinder("dish_mount", 0.015, 0.15, (bw*0.1, bd*0.15, top_z + 0.1), palette['steel'], 4, group)

    # Antenna
    if random.random() > 0.35:
        ant_h = 0.5 + random.random() * 0.4
        ax = bw * 0.35
        ay = bd * 0.3
        ant = create_cylinder("antenna", 0.015, ant_h, (ax, ay, top_z + ant_h/2), palette['steel'], 4, group)
        ant.rotation_euler = (0, 0, random.random() * 0.3 - 0.15)
        # Red tip
        create_cylinder("ant_tip", 0.025, 0.04, (ax, ay, top_z + ant_h + 0.02), 
                        mat("red_tip", (0.8, 0.1, 0.1), 0.5), 6, group)

    # Vegetation patches on roof
    for vi in range(3):
        if random.random() > 0.5:
            continue
        vw = 0.2 + random.random() * 0.4
        vd = 0.15 + random.random() * 0.3
        create_box(f"veg_patch_{vi}", (vw, vd, 0.025),
                   ((random.random()-0.5)*bw*0.6, (random.random()-0.5)*bd*0.6, top_z + 0.17),
                   palette['veg'], group)

    # Puddle
    if random.random() > 0.5:
        create_cylinder("puddle", 0.2 + random.random()*0.2, 0.01,
                        ((random.random()-0.5)*bw*0.3, (random.random()-0.5)*bd*0.3, top_z + 0.17),
                        mat("water_puddle", (0.15, 0.28, 0.40), 0.2, 0.1), 10, group)


def build_rubble_pile(group, bw, bd, count, palette, z_base=0.05):
    """Rubble pile at building base."""
    for i in range(count):
        side = random.choice([-1, 1])
        rx = bw * 0.5 * (random.random() - 0.3)
        ry = side * (bd/2 + 0.15 + random.random() * 0.4)
        rz = z_base + random.random() * 0.05
        s = 0.05 + random.random() * 0.1
        bpy.ops.mesh.primitive_ico_sphere_add(radius=s, subdivisions=1, location=(rx, ry, rz))
        obj = bpy.context.active_object
        obj.name = f"rubble_{i}"
        obj.scale = (1 + random.random()*0.5, 1 + random.random()*0.3, 0.5 + random.random()*0.5)
        bpy.ops.object.transform_apply(scale=True)
        mat_choice = random.choice([palette['wall'], palette['rubble'], palette['trim']])
        obj.data.materials.append(mat_choice)

    # Rebar sticking from rubble
    for i in range(3):
        if random.random() > 0.5:
            continue
        rx = bw * 0.3 * (random.random() - 0.5)
        ry = bd/2 + 0.2 + random.random() * 0.3
        rz = 0.15
        h = 0.15 + random.random() * 0.25
        rebar = create_cylinder(f"rubble_rebar_{i}", 0.01, h, (rx, ry, rz + h/2), palette['rebar'], 4, group)
        rebar.rotation_euler = (random.random()*0.4 - 0.2, random.random()*0.4 - 0.2, random.random()*math.pi)


def build_pipes(group, bw, bd, stories, z_base, steel_mat):
    """Vertical pipes on facade."""
    count = 1 + random.randint(0, 1)
    for pi in range(count):
        px = bw * (0.3 + pi * 0.15) * (1 if pi % 2 == 0 else -1)
        ph = stories * 0.8 * (0.4 + random.random() * 0.4)
        pipe = create_cylinder(f"pipe_{pi}", 0.035, ph, (px, bd/2 + 0.04, z_base + ph/2 + 0.3), steel_mat, 6, group)
        # Clamps
        for j in range(3):
            create_cylinder(f"pipe_clamp_{pi}_{j}", 0.05, 0.03,
                           (px, bd/2 + 0.04, z_base + 0.5 + j * (ph/3)),
                           steel_mat, 6, group)


def build_graffiti(group, bw, bd, top_z, graffiti_mats):
    """Graffiti tags on walls."""
    count = 1 + random.randint(0, 2)
    for gi in range(count):
        gmat = random.choice(graffiti_mats)
        gw = 0.3 + random.random() * 0.5
        gh = 0.2 + random.random() * 0.4
        gz = 0.5 + random.random() * (top_z - 1.5)
        gside = random.choice([-1, 1])
        gx = (random.random() - 0.5) * bw * 0.5
        gy = gside * (bd/2 + 0.015)
        create_box(f"graffiti_{gi}", (gw, 0.015, gh), (gx, gy, gz), gmat, group)


def build_stains(group, bw, bd, z_base, stories, stain_mat):
    """Water damage stains on walls."""
    for si in range(4):
        if random.random() > 0.6:
            continue
        sh = 0.3 + random.random() * 0.6
        sx = (random.random() - 0.5) * bw * 0.7
        sside = random.choice([-1, 1])
        sy = sside * (bd/2 + 0.015)
        sz = z_base + 0.5 + random.random() * (stories - 1.5)
        create_box(f"stain_{si}", (0.06 + random.random()*0.1, 0.015, sh),
                   (sx, sy, sz), stain_mat, group)


def build_building(bw, bd, stories, palette_fn, hole_chance=0.25, include_fire_escape=True, include_balconies=True):
    """Build a complete abandoned building. Returns the root group."""
    clear_scene()
    set_units()
    palette = palette_fn()
    g = bpy.data.collections.new("Building")
    bpy.context.scene.collection.children.link(g)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[g.name]

    fh = 1.0
    top = stories * fh
    stain_mat = mat("wall_stain", (0.10, 0.10, 0.10), 0.95)
    graffiti_mats = [
        mat("graffiti_red", (0.86, 0.15, 0.15), 0.9),
        mat("graffiti_blue", (0.15, 0.39, 0.92), 0.9),
        mat("graffiti_green", (0.09, 0.64, 0.29), 0.9),
        mat("graffiti_yellow", (0.96, 0.62, 0.04), 0.9),
        mat("graffiti_pink", (0.96, 0.25, 0.37), 0.9),
    ]

    # Floors + walls with holes
    for f in range(stories):
        z = f * fh
        # Floor slab
        build_floor_slab(g, bw, bd, z, palette['trim'])
        # Walls with holes
        build_walls_with_holes(g, bw, bd, z, fh, palette['wall'], palette['glass'], hole_chance)
        # Windows on every floor above ground
        if f > 0:
            build_window_row(g, bw, bd, z, palette['wall'], palette['glass'], palette['board'])

    # Roof slab (on top)
    create_box("roof_slab", (bw, bd, 0.15), (0, 0, top + 0.075), palette['wall'], g)

    # Structural details
    if include_fire_escape and stories >= 3:
        build_fire_escape(g, bw, bd, stories, 0, palette['steel'])
    if include_balconies and stories >= 3:
        build_balconies(g, bw, bd, stories, 0, palette['accent'], palette['steel'])

    build_roof_details(g, bw, bd, top, palette)
    build_pipes(g, bw, bd, stories, 0, palette['steel'])
    build_graffiti(g, bw, bd, top, graffiti_mats)
    build_stains(g, bw, bd, 0, stories, stain_mat)
    build_rubble_pile(g, bw, bd, 8 + random.randint(0, 6), palette)

    return g


def export_building(name, bw, bd, stories, palette_fn, hole_chance=0.25,
                    include_fire_escape=True, include_balconies=True):
    """Build and export a single building."""
    print(f"\n=== Generating {name} ({bw}x{bd}, {stories} stories) ===")
    g = build_building(bw, bd, stories, palette_fn, hole_chance,
                       include_fire_escape, include_balconies)
    path = os.path.join(OUTPUT_DIR, f"{name}.glb")
    export_glb(path)
    print(f"Exported: {path}")
    return path


def main():
    print("=== Post-Apocalyptic Building Generator ===")
    print(f"Output: {OUTPUT_DIR}")

    paths = []

    # 1. Top-left: Concrete tower (8.8 x 5.4, 8 stories, leaning, lots of holes)
    paths.append(export_building(
        "building_top_left", 8.8, 5.4, 8,
        make_concrete_palette, hole_chance=0.35,
        include_fire_escape=True, include_balconies=True,
    ))

    # 2. Top-center: Brick building (9.4 x 5.4, 9 stories, cave-in, exposed beams)
    paths.append(export_building(
        "building_top_center", 9.4, 5.4, 9,
        make_brick_palette, hole_chance=0.30,
        include_fire_escape=True, include_balconies=True,
    ))

    # 3. Top-right: Gutted steel frame (10.0 x 5.4, 8 stories, mostly walls + frame)
    paths.append(export_building(
        "building_top_right", 10.0, 5.4, 8,
        make_slate_palette, hole_chance=0.45,
        include_fire_escape=True, include_balconies=False,
    ))

    # 4. Mid-right: Standing slate (10.0 x 5.4, 9 stories, broken corner)
    paths.append(export_building(
        "building_mid_right", 10.0, 5.4, 9,
        make_slate_palette, hole_chance=0.30,
        include_fire_escape=True, include_balconies=True,
    ))

    # 5. Bottom-right: Mixed industrial (10.0 x 4.0, 7 stories, partial collapse)
    paths.append(export_building(
        "building_bottom_right", 10.0, 4.0, 7,
        make_wood_palette, hole_chance=0.35,
        include_fire_escape=True, include_balconies=True,
    ))

    print(f"\n=== Done! Generated {len(paths)} buildings ===")
    for p in paths:
        print(f"  {p}")


if __name__ == "__main__":
    main()

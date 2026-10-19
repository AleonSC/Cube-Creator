"""
Cube Creator -> Blender setup script (generated).

Usage:
  1. Unzip this bundle somewhere.
  2. In Blender: Scripting workspace -> Open -> setup_blender.py -> Run Script.
     (or from a terminal:  blender --python setup_blender.py)

It imports the .glb next to this file, then rebuilds what glTF cannot carry:
world / background, bloom, camera, lights, idle animation range and the
particle layers (as Blender particle systems with glowing instances).
Tested against Blender 3.6 - 4.x; every optional step is wrapped so newer
versions degrade gracefully instead of failing.
"""
import json
import math
import os

import bpy
from mathutils import Vector

CONFIG = json.loads(r'''__CONFIG__''')
GLB_NAME = "__GLB__"


# --------------------------------------------------------------------- utils
def find_bundle_dir():
    candidates = []
    try:
        candidates.append(os.path.dirname(os.path.abspath(__file__)))
    except NameError:
        pass
    for text in bpy.data.texts:
        if text.filepath:
            candidates.append(os.path.dirname(bpy.path.abspath(text.filepath)))
    if bpy.data.filepath:
        candidates.append(os.path.dirname(bpy.data.filepath))
    candidates.append(os.getcwd())
    for d in candidates:
        if os.path.exists(os.path.join(d, GLB_NAME)):
            return d
    raise FileNotFoundError("Could not find %s next to this script. Keep the bundle files together." % GLB_NAME)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_color(h, alpha=1.0):
    h = (h or "#ffffff").lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (alpha,)


def three_to_blender(x, y, z):
    """three.js is Y-up, Blender is Z-up."""
    return Vector((x, -z, y))


def safe(label, fn, *args):
    try:
        return fn(*args)
    except Exception as exc:  # keep going on API differences between versions
        print("[CubeCreator] skipped %s: %s" % (label, exc))
        return None


# --------------------------------------------------------------------- scene
def import_model(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]
    by_prefix = lambda p: next((o for o in imported if o.name.startswith(p)), None)
    return imported, by_prefix("CubeMesh"), by_prefix("Pivot")


def setup_render(scene):
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    for view in ("AgX", "Filmic"):
        try:
            scene.view_settings.view_transform = view
            break
        except TypeError:
            continue
    scene.view_settings.exposure = math.log2(max(0.05, CONFIG["scene"]["exposure"]))
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 1080
    scene.render.film_transparent = CONFIG["scene"]["bgStyle"] == "transparent"
    eevee = scene.eevee
    if hasattr(eevee, "use_ssr"):
        eevee.use_ssr = True
        eevee.use_ssr_refraction = True


def setup_bloom(scene):
    post = CONFIG["post"]
    if not post.get("bloom"):
        return
    eevee = scene.eevee
    if hasattr(eevee, "use_bloom"):  # Blender < 4.2
        eevee.use_bloom = True
        eevee.bloom_intensity = 0.05 * post["bloomStrength"] * 2
        eevee.bloom_threshold = post["bloomThreshold"]
        eevee.bloom_radius = 4 + post["bloomRadius"] * 6
        return
    # Blender 4.2+: bloom lives in the compositor (Glare node)
    if hasattr(scene, "compositing_node_group"):
        tree = bpy.data.node_groups.new("CubeCreatorBloom", "CompositorNodeTree")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        scene.compositing_node_group = tree
        out = tree.nodes.new("NodeGroupOutput")
    else:
        scene.use_nodes = True
        tree = scene.node_tree
        out = tree.nodes.get("Composite") or tree.nodes.new("CompositorNodeComposite")
    rl = tree.nodes.get("Render Layers") or tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    for kind in ("BLOOM", "FOG_GLOW"):
        try:
            glare.glare_type = kind
            break
        except TypeError:
            continue
    if hasattr(glare, "threshold"):
        glare.threshold = post["bloomThreshold"]
    elif "Threshold" in glare.inputs:
        glare.inputs["Threshold"].default_value = post["bloomThreshold"]
    if "Strength" in glare.inputs:
        glare.inputs["Strength"].default_value = post["bloomStrength"]
    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], out.inputs[0])


def setup_world(scene):
    s = CONFIG["scene"]
    world = scene.world or bpy.data.worlds.new("CubeCreatorWorld")
    scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputWorld")
    bg = nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 0.6 * s["envIntensity"]
    if s["bgStyle"] == "gradient":
        tex = nodes.new("ShaderNodeTexCoord")
        sep = nodes.new("ShaderNodeSeparateXYZ")
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.4
        ramp.color_ramp.elements[0].color = hex_color(s["bgBottom"])
        ramp.color_ramp.elements[1].position = 0.75
        ramp.color_ramp.elements[1].color = hex_color(s["bgTop"])
        mapr = nodes.new("ShaderNodeMapRange")
        mapr.inputs["From Min"].default_value = -1.0
        mapr.inputs["From Max"].default_value = 1.0
        links.new(tex.outputs["Generated"], sep.inputs[0])
        links.new(sep.outputs["Z"], mapr.inputs["Value"])
        links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], bg.inputs["Color"])
    else:
        bg.inputs["Color"].default_value = hex_color(s["bgBottom"])
    links.new(bg.outputs["Background"], out.inputs["Surface"])


def setup_camera_and_lights(scene, target):
    s = CONFIG["scene"]
    cam_data = bpy.data.cameras.new("CubeCam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("CubeCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = three_to_blender(2.4, 1.7, 3.1) * 1.15
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = cam

    def area(name, loc, color, power, size=2.0):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = power
        data.size = size
        data.color = hex_color(color)[:3]
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        c = obj.constraints.new("TRACK_TO")
        c.target = target
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"
        return obj

    area("KeyLight", three_to_blender(3, 5, 2.5), s["keyColor"], 120 * s["keyLight"])
    area("RimLight", three_to_blender(-3, 2, -4), s["rimColor"], 90 * s["rimLight"])


def setup_timeline(scene, objects):
    fps = scene.render.fps
    end = 250
    for o in objects:
        ad = o.animation_data
        if ad and ad.action:
            end = max(end, int(math.ceil(ad.action.frame_range[1])))
    scene.frame_start = 1
    scene.frame_end = end


# ----------------------------------------------------------------- particles
def mesh_object(name, verts, faces, parent=None, scene=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    (scene or bpy.context.scene).collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def octahedron(r=1.0):
    v = [(r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r), (0, 0, -r)]
    f = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    return v, f


def sphere_mesh(r, seg=16, rings=10):
    verts, faces = [], []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            verts.append((r * math.sin(th) * math.cos(ph), r * math.sin(th) * math.sin(ph), r * math.cos(th)))
    for i in range(rings):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    return verts, faces


def plane(cx, cy, cz, sx, sy):
    return [(cx - sx, cy - sy, cz), (cx + sx, cy - sy, cz), (cx + sx, cy + sy, cz), (cx - sx, cy + sy, cz)], [(0, 1, 2, 3)]


def ring(r, seg=48, w=0.02):
    verts, faces = [], []
    for j in range(seg):
        a = 2 * math.pi * j / seg
        verts.append(((r - w) * math.cos(a), (r - w) * math.sin(a), 0))
        verts.append(((r + w) * math.cos(a), (r + w) * math.sin(a), 0))
    for j in range(seg):
        k = (j + 1) % seg
        faces.append((j * 2, j * 2 + 1, k * 2 + 1, k * 2))
    return verts, faces


def particle_material(layer):
    mat = bpy.data.materials.new("CC_" + layer["name"])
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    info = nodes.new("ShaderNodeParticleInfo")
    age = nodes.new("ShaderNodeMath")
    age.operation = "DIVIDE"
    links.new(info.outputs["Age"], age.inputs[0])
    links.new(info.outputs["Lifetime"], age.inputs[1])
    ramp = nodes.new("ShaderNodeValToRGB")
    if layer.get("colorMode") == "randomHue":
        ramp.color_ramp.elements[0].color = (1, 0.2, 0.2, 1)
        ramp.color_ramp.elements[1].color = (0.2, 0.4, 1, 1)
        links.new(info.outputs["Random"], ramp.inputs["Fac"])
    else:
        ramp.color_ramp.elements[0].color = hex_color(layer["colorStart"])
        ramp.color_ramp.elements[1].color = hex_color(layer["colorEnd"])
        links.new(age.outputs[0], ramp.inputs["Fac"])
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = max(0.2, layer["brightness"]) * (2.0 if layer["blending"] != "normal" else 0.8)
    links.new(ramp.outputs["Color"], emit.inputs["Color"])
    fade = nodes.new("ShaderNodeMath")
    fade.operation = "SUBTRACT"
    fade.inputs[0].default_value = 1.0
    links.new(age.outputs[0], fade.inputs[1])
    alpha = nodes.new("ShaderNodeMath")
    alpha.operation = "MULTIPLY"
    alpha.inputs[1].default_value = layer["opacity"]
    links.new(fade.outputs[0], alpha.inputs[0])
    transp = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(alpha.outputs[0], mix.inputs[0])
    links.new(transp.outputs[0], mix.inputs[1])
    links.new(emit.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        if hasattr(mat, attr):
            safe(attr, setattr, mat, attr, value)
    return mat


def build_particles(scene, cube, pivot):
    layers = CONFIG.get("particles") or []
    if not layers or cube is None:
        return
    b = CONFIG["bounds"]
    parent = pivot or cube
    holder = bpy.data.collections.new("CubeCreator_ParticleSources")
    scene.collection.children.link(holder)
    fps = scene.render.fps
    frames = scene.frame_end - scene.frame_start + 1

    for i, layer in enumerate(layers):
        name = "%02d_%s" % (i, layer["name"].replace(" ", "_"))
        bx, by, bz = b["x"] * layer["emitScale"], b["y"] * layer["emitScale"], b["z"] * layer["emitScale"]
        max_b = max(bx, by, bz)
        where = layer["emitFrom"]
        # Blender axes: X = x, Y = -z(three), Z = y(three)
        helper = None
        if where in ("surface", "volume"):
            emitter = cube
        else:
            if where == "top":
                v, f = plane(0, 0, by, bx, bz)
            elif where == "bottom":
                v, f = plane(0, 0, -by, bx, bz)
            elif where == "above":
                v, f = plane(0, 0, by * 3.5, bx * 2, bz * 2)
            elif where == "sphere":
                v, f = sphere_mesh(max_b * 1.25)
            elif where == "ring":
                v, f = ring(max_b * 1.4)
            else:
                v, f = octahedron(0.01)
            helper = mesh_object("CC_Emitter_" + name, v, f, parent=parent, scene=scene)
            helper.display_type = "WIRE"
            emitter = helper

        inst_v, inst_f = octahedron(1.0)
        inst = mesh_object("CC_Particle_" + name, inst_v, inst_f, scene=scene)
        scene.collection.objects.unlink(inst)
        holder.objects.link(inst)
        inst.data.materials.append(particle_material(layer))
        inst.hide_render = True
        inst.hide_viewport = True

        mod = emitter.modifiers.new("CC_" + name, "PARTICLE_SYSTEM")
        psys = mod.particle_system
        psys.seed = int(layer.get("seed", 1))
        st = psys.settings
        st.name = "CC_" + name
        life = max(1, int(layer["lifetime"] * fps))
        st.frame_start = scene.frame_start - life
        st.frame_end = scene.frame_end
        st.count = max(1, int(layer["rate"] * (frames + life) / fps))
        st.lifetime = life
        st.lifetime_random = layer["lifetimeVar"]
        st.emit_from = "VOLUME" if where == "volume" else ("VERT" if where == "point" else "FACE")
        st.use_emit_random = True

        speed = layer["speed"]
        direction = layer["direction"]
        st.normal_factor = 0.0
        st.factor_random = layer["spread"] * max(0.05, speed)
        if direction == "outward":
            st.normal_factor = speed
        elif direction == "inward":
            st.normal_factor = -speed
        elif direction == "random":
            st.factor_random = speed
        elif direction in ("up", "down"):
            st.object_align_factor = (0, 0, speed if direction == "up" else -speed)
        elif direction in ("orbit", "swirlUp"):
            st.tangent_factor = speed
            if direction == "swirlUp":
                st.object_align_factor = (0, 0, speed * 0.7)
        st.effector_weights.gravity = max(-1.0, min(1.0, layer["gravity"] / 9.81))
        st.brownian_factor = layer["turbulence"] * 0.4
        st.drag_factor = min(1.0, layer["drag"] * 0.25)
        st.render_type = "OBJECT"
        st.instance_object = inst
        st.particle_size = layer["size"] * 0.5
        st.size_random = 0.4
        if helper is not None:
            helper.show_instancer_for_render = False
            helper.show_instancer_for_viewport = False


# ---------------------------------------------------------------------- main
def main():
    scene = bpy.context.scene
    folder = find_bundle_dir()
    objects, cube, pivot = import_model(os.path.join(folder, GLB_NAME))
    target = pivot or cube or (objects[0] if objects else None)
    safe("render settings", setup_render, scene)
    safe("world", setup_world, scene)
    safe("bloom", setup_bloom, scene)
    if target is not None:
        safe("camera and lights", setup_camera_and_lights, scene, target)
    safe("timeline", setup_timeline, scene, objects)
    safe("particles", build_particles, scene, cube, pivot)
    print("[CubeCreator] '%s' is ready. Press F12 to render, Space to play the idle animation." % CONFIG.get("name"))


main()

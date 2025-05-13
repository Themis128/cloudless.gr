<template>
    <div class="model-bg-root">
        <canvas ref="threeCanvas" class="model-3d-bg-canvas"></canvas>
        <div class="model-layout model-content-wrapper">
            <div class="model-content">
                <slot />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { onMounted, onUnmounted, ref } from 'vue';

const threeCanvas = ref<HTMLCanvasElement | null>(null);
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let animationId: number | null = null;

function init3DGraph() {
    if (!threeCanvas.value) return;
    renderer = new THREE.WebGLRenderer({ canvas: threeCanvas.value, antialias: true, alpha: true });
    renderer.setClearColor(0xe0e7ff, 1);
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0e7ff);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 7);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x2563eb, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Visualize LLM as a network of nodes (spheres) and connections (lines)
    const nodeGeometry = new THREE.SphereGeometry(0.55, 48, 48);
    const nodes: THREE.Mesh[] = [];
    const nodePositions = [
        [0, 0, 0],
        [2.2, 1.7, 0.7],
        [-2.2, 1.7, -0.7],
        [2.2, -1.7, -0.7],
        [-2.2, -1.7, 0.7],
        [0, 3.2, 0],
        [0, -3.2, 0],
    ];
    nodePositions.forEach((pos, i) => {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        mat.emissive = new THREE.Color().setHSL(i / nodePositions.length, 0.7, 0.45);
        mat.color.setHSL(i / nodePositions.length, 0.7, 0.55);
        mat.emissiveIntensity = 0.45;
        const node = new THREE.Mesh(nodeGeometry, mat);
        node.position.set(pos[0], pos[1], pos[2]);
        scene!.add(node);
        nodes.push(node);
    });
    // Connections (edges)
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 3 });
    const edges = [
        [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 5], [2, 5], [3, 6], [4, 6],
        [1, 2], [3, 4],
    ];
    edges.forEach(([a, b]) => {
        const points = [nodes[a].position, nodes[b].position];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, edgeMaterial.clone());
        // Glow effect to lines
        (line.material as THREE.LineBasicMaterial).color.setHSL((a + b) / nodePositions.length, 0.5, 0.45);
        scene!.add(line);
    });

    function animate() {
        animationId = requestAnimationFrame(animate);
        nodes.forEach((node, i) => {
            node.rotation.y += 0.012 + i * 0.001;
            node.rotation.x += 0.007 + i * 0.0005;
        });
        scene!.rotation.y += 0.0025;
        renderer!.render(scene!, camera!);
    }
    animate();

    // Responsive resize
    function onResize() {
        if (!renderer || !camera) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);
}

onMounted(() => {
    init3DGraph();
});

onUnmounted(() => {
    if (animationId) cancelAnimationFrame(animationId);
    if (renderer) renderer.dispose();
    window.removeEventListener('resize', () => { });
    scene = null;
    camera = null;
    renderer = null;
});
</script>

<style scoped>
.model-bg-root {
    position: relative;
    min-height: 100vh;
    min-width: 100vw;
    overflow: hidden;
}

.model-3d-bg-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(135deg, #e0e7ff 0%, #f0f4ff 100%);
    display: block;
}

.model-content-wrapper {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: row;
    min-height: 100vh;
}

.model-content {
    flex: 1 1 100%;
    padding: 2.5rem 2rem;
    min-width: 0;
    max-width: 100vw;
}

@media (max-width: 900px) {
    .model-content-wrapper {
        flex-direction: column;
    }

    .model-content {
        padding: 1.2rem 0.5rem;
    }
}

@media (forced-colors: active) {

    .model-layout,
    .model-3d-graph-container,
    .model-content {
        forced-color-adjust: none;
        background: Canvas !important;
        color: CanvasText !important;
        border-color: GrayText !important;
    }

    .model-3d-canvas {
        background: Canvas !important;
        border-color: GrayText !important;
    }

    button,
    .codegen-btn {
        background-color: ButtonFace !important;
        color: ButtonText !important;
        border-color: GrayText !important;
    }
}

@media (forced-colors: active) and (prefers-color-scheme: light) {

    .model-layout,
    .model-3d-graph-container,
    .model-content {
        background: Window !important;
        color: WindowText !important;
    }
}

@media (forced-colors: active) and (prefers-color-scheme: dark) {

    .model-layout,
    .model-3d-graph-container,
    .model-content {
        background: WindowText !important;
        color: Window !important;
    }
}

.opt-out-of-high-contrast {
    forced-color-adjust: none;
}
</style>

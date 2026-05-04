'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '@/hooks/useMultiplayer';

export default function GameMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { players, isConnected, sendMove } = useMultiplayer();
  const localPlayerRef = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<THREE.Scene | null>(null);
  const localMeshRef = useRef<THREE.Mesh | null>(null);
  const otherMeshesRef = useRef<Record<string, THREE.Mesh>>({});

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00ff00);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
    grid.position.z = 0.1;
    scene.add(grid);

    const localGeo = new THREE.CircleGeometry(0.5, 32);
    const localMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const localMesh = new THREE.Mesh(localGeo, localMat);
    localMesh.position.set(0, 0, 0.2);
    scene.add(localMesh);
    localMeshRef.current = localMesh;

    const handleKeyDown = (e: KeyboardEvent) => {
      let { x, y } = localPlayerRef.current;
      const speed = 0.5;
      switch (e.key) {
        case 'w': case 'ArrowUp': y += speed; break;
        case 's': case 'ArrowDown': y -= speed; break;
        case 'a': case 'ArrowLeft': x -= speed; break;
        case 'd': case 'ArrowRight': x += speed; break;
        default: return;
      }
      localPlayerRef.current = { x, y };
      localMesh.position.set(x, y, 0.2);
      sendMove(x, y);
    };
    window.addEventListener('keydown', handleKeyDown);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    Object.entries(players).forEach(([userId, pos]) => {
      if (!otherMeshesRef.current[userId]) {
        const geo = new THREE.CircleGeometry(0.5, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const mesh = new THREE.Mesh(geo, mat);
        sceneRef.current.add(mesh);
        otherMeshesRef.current[userId] = mesh;
      }
      otherMeshesRef.current[userId].position.set(pos.x, pos.y, 0.2);
    });
  }, [players]);

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Connecting...
      </div>
    );
  }

  return <div className="w-full h-screen" ref={mountRef} />;
}

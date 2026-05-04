'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '@/hooks/useMultiplayer';

export default function GameMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { players, isConnected, sendMove } = useMultiplayer();
  const localPlayerRef = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<THREE.Scene | null>(null);
  const localMeshRef = useRef<THREE.Mesh | null>(null);
  const otherMeshesRef = useRef<Record<string, THREE.Mesh>>({});
  const [showTutorial, setShowTutorial] = useState(false);

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

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
    grid.position.z = 0.1;
    scene.add(grid);

    // Local player (blue)
    const localGeo = new THREE.CircleGeometry(0.5, 32);
    const localMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const localMesh = new THREE.Mesh(localGeo, localMat);
    localMesh.position.set(0, 0, 0.2);
    scene.add(localMesh);
    localMeshRef.current = localMesh;

    // NPC - Tutorial pet (yellow)
    const npcGeo = new THREE.CircleGeometry(0.4, 32);
    const npcMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const npcMesh = new THREE.Mesh(npcGeo, npcMat);
    npcMesh.position.set(2, 0, 0.2);
    scene.add(npcMesh);

    // Check distance to NPC
    const checkNPCDistance = () => {
      const dist = localMesh.position.distanceTo(npcMesh.position);
      if (dist < 1.5) {
        setShowTutorial(true);
      } else {
        setShowTutorial(false);
      }
    };

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
      checkNPCDistance();
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
        const geometry = new THREE.CircleGeometry(0.5, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(pos.x, pos.y, 0.2);
        sceneRef.current?.add(mesh);
        otherMeshesRef.current[userId] = mesh;
      } else {
        otherMeshesRef.current[userId].position.set(pos.x, pos.y, 0.2);
      }
    });
  }, [players]);

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Connecting...
      </div>
    );
  }

  return (
    <div>
      <div className="w-full h-screen" ref={mountRef} />
      {showTutorial && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">🤖 Meet Your Pet!</h2>
            <p className="text-gray-300 mb-4">
              This little yellow circle is your new pet! But it needs a name...
            </p>
            <p className="text-gray-300 mb-6">
              In Java, we declare a String variable like this:
            </p>
            <pre className="bg-gray-900 p-4 rounded mb-6 text-green-400">
              String petName = "Sparky";
            </pre>
            <a
              href="/game/tutorial"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded text-white font-semibold inline-block"
            >
              Start Tutorial →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

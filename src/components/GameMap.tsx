"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useMultiplayer } from "@/hooks/useMultiplayer";

export default function GameMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { connected, players, movePlayer, playerId } = useMultiplayer();
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    playerMesh: THREE.Mesh;
    playerPos: { x: number; y: number };
    keys: Set<string>;
    otherPlayers: Map<string, THREE.Mesh>;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x228b22);

    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      1000
    );
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    const geometry = new THREE.CircleGeometry(20, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const playerMesh = new THREE.Mesh(geometry, material);
    scene.add(playerMesh);

    const keys = new Set<string>();
    const otherPlayers = new Map<string, THREE.Mesh>();

    sceneRef.current = {
      scene,
      camera,
      renderer,
      playerMesh,
      playerPos: { x: 0, y: 0 },
      keys,
      otherPlayers,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const animate = () => {
      if (!sceneRef.current) return;

      const { playerPos, keys, playerMesh, renderer, scene, camera } =
        sceneRef.current;

      const speed = 5;
      if (keys.has("w") || keys.has("arrowup")) playerPos.y += speed;
      if (keys.has("s") || keys.has("arrowdown")) playerPos.y -= speed;
      if (keys.has("a") || keys.has("arrowleft")) playerPos.x -= speed;
      if (keys.has("d") || keys.has("arrowright")) playerPos.x += speed;

      playerMesh.position.x = playerPos.x;
      playerMesh.position.y = playerPos.y;

      movePlayer(playerPos.x, playerPos.y);

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !players) return;

    const { scene, otherPlayers } = sceneRef.current;

    players.forEach((player: any) => {
      if (player.id === playerId) return;

      if (!otherPlayers.has(player.id)) {
        const geometry = new THREE.CircleGeometry(20, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        otherPlayers.set(player.id, mesh);
      }

      const mesh = otherPlayers.get(player.id);
      if (mesh) {
        mesh.position.x = player.x;
        mesh.position.y = player.y;
      }
    });

    otherPlayers.forEach((mesh, id) => {
      if (!players.find((p: any) => p.id === id)) {
        scene.remove(mesh);
        otherPlayers.delete(id);
      }
    });
  }, [players, playerId]);

  return (
    <div>
      <canvas ref={canvasRef} />
      {!connected && (
        <div className="absolute top-4 left-4 text-white bg-black/50 px-3 py-1 rounded">
          Connecting...
        </div>
      )}
    </div>
  );
}

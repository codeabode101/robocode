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
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [code, setCode] = useState('String robotName = "Sparky";');
  const [output, setOutput] = useState('');
  const [success, setSuccess] = useState(false);

  const tutorialSteps = [
    {
      npcText: "Hey there! I'm Sparky, your new pet robot! But wait... I need a name! Can you declare a String variable for me?",
      showEditor: false,
    },
    {
      npcText: 'In Java, we declare variables like this: String variableName = "value";',
      showEditor: false,
    },
    {
      npcText: 'Your turn! Declare a String named "robotName" with the value "Sparky" (dont forget the semicolon!)',
      showEditor: true,
    },
  ];

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

    // NPC - Tutorial pet (yellow) at position (2, 0)
    const npcGeo = new THREE.CircleGeometry(0.4, 32);
    const npcMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const npcMesh = new THREE.Mesh(npcGeo, npcMat);
    npcMesh.position.set(2, 0, 0.2);
    scene.add(npcMesh);

    // Check distance to NPC
    const checkNPCDistance = () => {
      const dist = localMesh.position.distanceTo(npcMesh.position);
      if (dist < 1.5 && !showTutorial) {
        setShowTutorial(true);
        setTutorialStep(0);
      } else if (dist >= 1.5) {
        setShowTutorial(false);
        setTutorialStep(0);
        setSuccess(false);
        setOutput('');
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

  // Sync other players
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

  const handleNextStep = () => {
    if (tutorialStep < tutorialSteps.length - 1) {
      setTutorialStep(tutorialStep + 1);
    }
  };

  const checkAnswer = async () => {
    try {
      const res = await fetch('/api/tutorial/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, concept: 'string-variable' }),
      });
      const data = await res.json();
      
      if (data.valid) {
        setSuccess(true);
        setOutput('✅ Correct! You declared a String variable named robotName with value "Sparky"!');
        setTimeout(() => {
          setShowTutorial(false);
          setTutorialStep(0);
          setSuccess(false);
          setOutput('');
        }, 2000);
      } else {
        setOutput(`❌ ${data.error || 'Try again!'}`);
      }
    } catch (error) {
      setOutput('❌ Error checking answer');
    }
  };

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
          <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-2xl">
                🤖
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2">Sparky says:</h2>
                <p className="text-gray-300 mb-4">
                  {tutorialSteps[tutorialStep].npcText}
                </p>
              </div>
            </div>

            {tutorialSteps[tutorialStep].showEditor && (
              <div className="mb-4">
                <div className="bg-gray-900 p-4 rounded mb-4">
                  <pre className="text-green-400 text-sm">
                    {`// Type your answer below:\nString robotName = "Sparky";`}
                  </pre>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-24 bg-gray-900 text-green-400 p-4 rounded font-mono text-sm mb-4"
                  spellCheck={false}
                />
                {output && (
                  <div className={`p-4 rounded-lg mb-4 ${success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                    {output}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <div className="flex gap-2">
                {tutorialSteps.map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${i === tutorialStep ? 'bg-blue-600' : 'bg-gray-600'}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {tutorialStep < tutorialSteps.length - 1 ? (
                  <button
                    onClick={handleNextStep}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-white font-semibold"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={checkAnswer}
                    disabled={success}
                    className={`px-6 py-2 rounded font-semibold ${
                      success ? 'bg-green-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {success ? '✓ Completed!' : 'Submit Answer'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

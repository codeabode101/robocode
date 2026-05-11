'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TutorialPage() {
  const [code, setCode] = useState('String robotName = "Sparky";');
  const [output, setOutput] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const checkAnswer = async () => {
    const res = await fetch('/api/tutorial/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, concept: 'string-variable' }),
    });
    const data = await res.json();
    
    if (data.valid) {
      setSuccess(true);
      setOutput('✅ Correct! You declared a String variable named robotName with value "Sparky"!');
    } else {
      setOutput(`❌ ${data.error || 'Try again!'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Java Tutorial: Variables</h1>
        
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl mb-4">Challenge: Declare a String variable</h2>
          <p className="mb-4 text-gray-300">
            In Java, you can declare a String variable like this:
          </p>
          <pre className="bg-gray-900 p-4 rounded mb-4 overflow-x-auto">
            <code className="text-green-400">String variableName = "value";</code>
          </pre>
          <p className="mb-4 text-gray-300">
            Your task: Declare a String variable named <code className="bg-gray-700 px-2 py-1 rounded">robotName</code> with the value <code className="bg-gray-700 px-2 py-1 rounded">"Sparky"</code>
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg">Code Editor</h3>
            <span className="text-sm text-gray-400">Java</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-32 bg-gray-900 text-green-400 p-4 rounded font-mono text-sm mb-4"
            spellCheck={false}
          />
          <button
            onClick={checkAnswer}
            disabled={success}
            className={`px-6 py-2 rounded font-semibold ${
              success ? 'bg-green-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {success ? '✓ Completed!' : 'Submit Answer'}
          </button>
        </div>

        {output && (
          <div className={`p-4 rounded-lg ${
            success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
          }`}>
            <p>{output}</p>
            {success && (
              <button
                onClick={() => router.push('/game')}
                className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold"
              >
                Continue to Game →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

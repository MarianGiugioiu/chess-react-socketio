import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import vertexShader from '../shaders/plane/vertex.js';
import fragmentShader from '../shaders/plane/fragment.js';
import vertexShader1 from '../shaders/ray-marching/vertex.js';
import fragmentShader1 from '../shaders/ray-marching/fragment.js';

export default function PlaneComponent() {
  const meshRef = useRef();
  const materialRef = useRef();
  const { size, viewport } = useThree();

  useFrame(({ clock }) => {
    if (meshRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial 
        ref={materialRef}
        side={THREE.DoubleSide}
        vertexShader={vertexShader1}
        fragmentShader={fragmentShader1}
        uniforms={{ time: { value: 0 } }}
      />
    </mesh>
  );
}
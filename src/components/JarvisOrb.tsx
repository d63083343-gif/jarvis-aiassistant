import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, Icosahedron, Ring, Stars, Torus, Dodecahedron, Octahedron } from "@react-three/drei";
import * as THREE from "three";

type State = "idle" | "listening" | "thinking" | "speaking";

interface OrbProps {
  state: State;
  level: number; // 0..1 audio level
}

function Core({ state, level }: OrbProps) {
  const inner = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const dodec = useRef<THREE.Mesh>(null);
  const octa = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (!inner.current || !shell.current || !wire.current) return;
    const t = performance.now() * 0.001;
    const pulse = state === "speaking" ? 1 + level * 0.35 : state === "listening" ? 1 + level * 0.6 : 1 + Math.sin(t * 2) * 0.04;
    inner.current.scale.setScalar(pulse);
    shell.current.rotation.y += dt * (state === "thinking" ? 1.4 : 0.25);
    shell.current.rotation.x += dt * 0.12;
    wire.current.rotation.y -= dt * 0.4;
    wire.current.rotation.z += dt * 0.15;
    if (dodec.current) {
      dodec.current.rotation.y += dt * (state === "thinking" ? 0.9 : 0.35);
      dodec.current.rotation.x -= dt * 0.2;
      dodec.current.scale.setScalar(1 + Math.sin(t * 1.3) * 0.03 + level * 0.15);
    }
    if (octa.current) {
      octa.current.rotation.z += dt * 0.6;
      octa.current.rotation.x += dt * 0.3;
    }

    const mat = inner.current.material as THREE.MeshStandardMaterial;
    const target = state === "speaking" ? 3.2 + level * 2.5 : state === "listening" ? 2 + level * 3 : state === "thinking" ? 2.4 : 1.4;
    mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.1;
  });

  const color = state === "thinking" ? "#e6e2f5" : state === "speaking" ? "#b48bff" : "#7c5cff";

  return (
    <group>
      {/* Glowing core */}
      <Sphere ref={inner} args={[0.6, 64, 64]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          roughness={0.15}
          metalness={0.4}
        />
      </Sphere>
      {/* Inner octahedron gem */}
      <Octahedron ref={octa} args={[0.35, 0]}>
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={2}
          roughness={0}
          metalness={0.9}
          transparent
          opacity={0.85}
        />
      </Octahedron>
      {/* Faceted shell */}
      <Icosahedron ref={shell} args={[1.15, 1]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          wireframe
          transparent
          opacity={0.55}
        />
      </Icosahedron>
      {/* Dodecahedron mid-layer */}
      <Dodecahedron ref={dodec} args={[1.35, 0]}>
        <meshBasicMaterial color={color} wireframe transparent opacity={0.28} />
      </Dodecahedron>
      {/* Outer wire sphere */}
      <Sphere ref={wire} args={[1.55, 24, 24]}>
        <meshBasicMaterial color={color} wireframe transparent opacity={0.18} />
      </Sphere>
    </group>
  );
}

function OrbitRings() {
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);
  const g3 = useRef<THREE.Group>(null);
  const g4 = useRef<THREE.Group>(null);
  const g5 = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g1.current) g1.current.rotation.z += dt * 0.4;
    if (g2.current) g2.current.rotation.x += dt * 0.5;
    if (g3.current) g3.current.rotation.y -= dt * 0.3;
    if (g4.current) {
      g4.current.rotation.x += dt * 0.25;
      g4.current.rotation.y -= dt * 0.35;
    }
    if (g5.current) g5.current.rotation.z -= dt * 0.6;
  });
  return (
    <>
      <group ref={g1} rotation={[Math.PI / 2.4, 0, 0]}>
        <Ring args={[1.9, 1.94, 128]}>
          <meshBasicMaterial color="#b48bff" side={THREE.DoubleSide} transparent opacity={0.7} />
        </Ring>
      </group>
      <group ref={g2} rotation={[0, Math.PI / 3, Math.PI / 6]}>
        <Ring args={[2.15, 2.17, 128]}>
          <meshBasicMaterial color="#7c5cff" side={THREE.DoubleSide} transparent opacity={0.55} />
        </Ring>
      </group>
      <group ref={g3}>
        <Ring args={[2.5, 2.53, 128]}>
          <meshBasicMaterial color="#e6e2f5" side={THREE.DoubleSide} transparent opacity={0.35} />
        </Ring>
      </group>
      {/* Torus halo */}
      <group ref={g4} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <Torus args={[2.3, 0.012, 12, 200]}>
          <meshBasicMaterial color="#b48bff" transparent opacity={0.55} />
        </Torus>
      </group>
      {/* Tilted dash ring */}
      <group ref={g5} rotation={[Math.PI / 2, 0, Math.PI / 5]}>
        <Ring args={[2.75, 2.78, 96]}>
          <meshBasicMaterial color="#e6e2f5" side={THREE.DoubleSide} transparent opacity={0.28} />
        </Ring>
      </group>
    </>
  );
}

function Particles() {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const count = 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.8 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (points.current) {
      points.current.rotation.y += dt * 0.08;
      points.current.rotation.x += dt * 0.03;
    }
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial color="#b48bff" size={0.028} transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

export function JarvisOrb({ state, level }: OrbProps) {
  return (
    <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#00000000"]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#b48bff" />
      <pointLight position={[-5, -3, -3]} intensity={0.9} color="#e6e2f5" />
      <Stars radius={40} depth={30} count={800} factor={2} fade speed={0.6} />
      <Particles />
      <Core state={state} level={level} />
      <OrbitRings />
    </Canvas>
  );
}
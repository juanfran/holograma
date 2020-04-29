
AFRAME.registerComponent('holograma', {
  tick: () => {
    if (globalScene.particles) {
      globalScene.particles.material.uniforms.time.value += 0.01;
    }
  },
});

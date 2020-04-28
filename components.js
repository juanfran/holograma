var time = 0;

AFRAME.registerComponent('holograma', {
  tick: function(_time, _dt) {
    if (particles) {
      time += 0.01;
      particles.material.uniforms.time.value = time ;
    }
  },
});

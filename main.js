async function capture() {
  const imageBitmap = await globalScene.imageCapture.grabFrame();
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  canvas.getContext('2d').drawImage(imageBitmap, 0, 0);
  globalScene.textureOriginal = new THREE.Texture(canvas);
  globalScene.textureOriginal.needsUpdate = true;

  await loadAndPredict(globalScene.textureOriginal.image);
}

async function loadModel(){
  // Load the model
  globalScene.net = await bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
    internalResolution: 'medium',
    segmentationThreshold: 0.7
  });
}

async function loadAndPredict(img) {
  const segmentation = await globalScene.net.segmentPerson(img);
  createTextureAndParticlesFromSegmentation(segmentation);
}

function createTextureAndParticlesFromSegmentation(seg) {
  if (globalScene.particles) {
    aframeScene.removeChild(
      document.querySelector('[holograma]')
    );
  }

  const size = seg.width * seg.height;
  const data = new Uint8Array(3 * size);
  subsamplingFactor = 4;
  const w = seg.width;
  const h = seg.height;
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];

  let nAdded = 0;
  let u,v;

  for (var i = 0; i < size; i ++) {
    // Texture part
    var stride = i * 3;
    data[stride] = seg.data[i] * 255;
    data[stride + 1] = seg.data[i];
    data[stride + 2] = seg.data[i];

    // Particles part. We test if People or not to create a particle
    if(seg.data[i] > 0){
        if(nAdded % subsamplingFactor == 0){
            u = (i % w ) / w;
            v = Math.floor(i / w) / h;
            positions.push(Math.random(), Math.random(), Math.random());
            uvs.push(u, 1. - v);  // flip y
        }
        nAdded++;
    }
  }

  const worldPosition = new THREE.Vector3();
  globalScene.camera.object3D.getWorldPosition(worldPosition);
  // const worldQuaternion = new THREE.Quaternion();
  // globalScene.camera.object3D.getWorldQuaternion(worldQuaternion);
  // const worldHeading = new THREE.Vector3();
  // globalScene.camera.object3D.getWorldDirection(worldHeading);

  // Part particles
  geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  geometry.setAttribute( 'uvs', new THREE.Float32BufferAttribute( uvs, 2 ) );

  const shaderMaterialParticles = new THREE.ShaderMaterial( {
    uniforms: {
      optionMode: {value: 1},
      userPos: {value: worldPosition},
      width: {value: 1},
      height: {value: 1},
      time: {value: 0},
      originalImage: { value: globalScene.textureOriginal },
      depthMap: { value: globalScene.textureDepthMap}
    },
    vertexShader: globalScene.vertexshaderParticle,
    fragmentShader: globalScene.fragmentShader,
    depthTest: false,
    transparent: true,
    vertexColors: true
  });

  globalScene.particles = new THREE.Points(geometry, shaderMaterialParticles);
  globalScene.particles.material.uniforms.originalImage.value = globalScene.textureOriginal;
  globalScene.particles.position.z = -4;
  globalScene.particles.position.y = 1;
  globalScene.particles.frustumCulled = false;
  globalScene.particles.material.uniforms.width.value = w;
  globalScene.particles.material.uniforms.height.value = h;

  // Part texture
  textureSegmentation = new THREE.DataTexture(data, seg.width, seg.height, THREE.RGBFormat);
  textureSegmentation.flipY = true;
  globalScene.particles.material.uniforms.time.value = 0;
  globalScene.particles.material.uniforms.depthMap.value = textureSegmentation;

  const entityEl = document.createElement('a-entity');
  entityEl.setAttribute('holograma', '');
  entityEl.setObject3D('particle-system', globalScene.particles);

  globalScene.aframeScene.appendChild(entityEl);
}

function init() {
  loadModel();


  document.querySelector('a-scene').addEventListener('loaded', async () => {
    const responseFragmentShader = await fetch('./fragmentshaderParticle');
    globalScene.fragmentShader = await responseFragmentShader.text();

    const responseVertexshaderParticle = await fetch('./vertexshaderParticle');
    globalScene.vertexshaderParticle = await responseVertexshaderParticle.text();

    globalScene.aframeScene = document.querySelector('a-scene');

    globalScene.renderer = globalScene.aframeScene.renderer;
    globalScene.camera = document.querySelector('#camera');

    globalScene.aframeScene.addEventListener('click', () => {
      if (!globalScene.imageCapture) {
        const mediaStream = document.querySelector('video').srcObject;
        globalScene.imageCapture = new ImageCapture(mediaStream.getVideoTracks()[0]);
      }

      if (globalScene.net) {
        capture();
      }
    });
  })
}

init();

var net;
var renderer;
var particles;
var camera;
var aframeScene;
var textureOriginal = new THREE.Texture();
var textureDepthMap = new THREE.Texture();
var imageCapture;
var fragmentShader;
var vertexshaderParticle;

function capture() {
  imageCapture.grabFrame().then((imageBitmap) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    canvas.getContext('2d').drawImage(imageBitmap, 0, 0);
    textureOriginal = new THREE.Texture(canvas);
    textureOriginal.needsUpdate = true;

    loadAndPredict(textureOriginal.image);
  });
}

async function loadModel(){
  // Load the model
  net = await bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
    internalResolution: 'medium',
    segmentationThreshold: 0.7
  });
}

async function loadAndPredict(img) {
  const segmentation = await net.segmentPerson(img);
  createTextureAndParticlesFromSegmentation(segmentation);
}

function createTextureAndParticlesFromSegmentation(seg) {
  if(particles) {
    aframeScene.removeObject3D('particle-system');
  }

  var size = seg.width * seg.height;
  var data = new Uint8Array(3 * size);
  subsamplingFactor = 4;
  var w = seg.width;
  var h = seg.height;
  var geometry = new THREE.BufferGeometry();
  var positions = [];
  var uvs = [];
  var u,v;
  var nAdded = 0;

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
  camera.object3D.getWorldPosition(worldPosition);
  const worldQuaternion = new THREE.Quaternion();
  camera.object3D.getWorldQuaternion(worldQuaternion);
  const worldHeading = new THREE.Vector3();
  camera.object3D.getWorldDirection(worldHeading);

  // Part particles
  geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  geometry.setAttribute( 'uvs', new THREE.Float32BufferAttribute( uvs, 2 ) );

  const shaderMaterialParticles = new THREE.ShaderMaterial( {
    uniforms: {
      optionMode: {value: 1},
      userPos: {value: worldPosition},
      width: {value: 1},
      height: {value: 1},
      time: {value: time},
      originalImage: { value: textureOriginal },
      depthMap: { value: textureDepthMap}
    },
    vertexShader: vertexshaderParticle,
    fragmentShader: fragmentShader,
    depthTest: false,
    transparent: true,
    vertexColors: true
  });

  particles = new THREE.Points(geometry, shaderMaterialParticles);
  particles.material.uniforms.originalImage.value = textureOriginal;
  particles.position.z = -4;
  particles.position.y = 1;
  particles.frustumCulled = false;
  particles.material.uniforms.width.value = w;
  particles.material.uniforms.height.value = h;

  // Part texture
  textureSegmentation = new THREE.DataTexture(data, seg.width, seg.height, THREE.RGBFormat);
  textureSegmentation.flipY = true;
  time = 0;
  particles.material.uniforms.time.value = time;
  particles.material.uniforms.depthMap.value = textureSegmentation;

  var entityEl = document.createElement('a-entity');
  entityEl.setObject3D('particle-system', particles);

  aframeScene.appendChild(entityEl);
}

function init() {
  loadModel();


  document.querySelector('a-scene').addEventListener('loaded', async () => {
    const responseFragmentShader = await fetch('./fragmentshaderParticle');
    fragmentShader = await responseFragmentShader.text();

    const responseVertexshaderParticle = await fetch('./vertexshaderParticle');
    vertexshaderParticle = await responseVertexshaderParticle.text();

    aframeScene = document.querySelector('a-scene');

    renderer = aframeScene.renderer;
    camera = document.querySelector('#camera');

    aframeScene.addEventListener('click', () => {
      if (!imageCapture) {
        const mediaStream = document.querySelector('video').srcObject;
        imageCapture = new ImageCapture(mediaStream.getVideoTracks()[0]);
      }

      if (net) {
        capture();
      }
    });
  })
}

init();

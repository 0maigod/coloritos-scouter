const token = process.argv[2];

if (!token) {
  console.error('\n❌ Error: Debes pasar el token de Vimeo como argumento.');
  console.log('Uso: node test-api.js TU_VIMEO_ACCESS_TOKEN\n');
  process.exit(1);
}

async function testVimeoAPI() {
  console.log('⏳ Conectando con la API de Vimeo...\n');
  
  try {
    const response = await fetch('https://api.vimeo.com/me', {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Conexión exitosa!`);
    console.log(`👤 Usuario logueado: ${data.name}`);
    console.log(`🔗 Link a tu perfil: ${data.link}`);
    console.log(`👥 Cuentas que sigues: ${data.metadata?.connections?.following?.total || 0}`);
    
    console.log('\n⏳ Obteniendo algunas cuentas que sigues...');
    const followingResponse = await fetch('https://api.vimeo.com/me/following?per_page=3', {
      headers: {
         'Authorization': `bearer ${token}`,
         'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });
    
    if (followingResponse.ok) {
       const followingData = await followingResponse.json();
       followingData.data.forEach((user, i) => {
           console.log(`   ${i+1}. ${user.name} (${user.link})`);
       });
       console.log('\n🎉 ¡La API de Vimeo funciona perfectamente y tienes acceso a los directores que sigues!');
    } else {
        console.error('⚠️ No pudimos obtener a quién sigues. Asegúrate de tener el scope "private".');
    }

  } catch (error) {
    console.error('\n❌ Error al conectar con la API:');
    console.error(error.message);
  }
}

testVimeoAPI();

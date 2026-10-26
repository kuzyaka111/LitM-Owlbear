import {getCloudClient} from './cloud-client.js';
import './cloud-auth.css';
const message=document.querySelector('#cloud-auth-message'),form=document.querySelector('#cloud-password'),recovery=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
async function start(){
 const client=await getCloudClient();const {data,error}=await client.auth.getSession();
 if(error||!data.session){message.textContent='Ссылка недействительна или уже использована. Вернитесь в Owlbear и запросите новое письмо.';return;}
 if(!recovery){message.textContent='Адрес подтверждён. Теперь можно войти в облако из панели ведущего.';return;}
 message.textContent='Задайте новый пароль — не менее 8 символов.';form.hidden=false;
 form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('button');button.disabled=true;const {error}=await client.auth.updateUser({password:form.elements.password.value});if(error){message.textContent='Не удалось сменить пароль. Запросите новое письмо или попробуйте ещё раз.';button.disabled=false;}else{form.reset();form.hidden=true;message.textContent='Пароль изменён. Вернитесь в Owlbear и войдите с новым паролем.';}});
}
void start().catch(()=>{message.textContent='Не удалось проверить ссылку. Проверьте соединение и откройте письмо снова.';});

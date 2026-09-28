const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const app=express(),server=http.createServer(app),io=new Server(server);
const PORT=process.env.PORT||10000;
app.use(express.static(path.join(__dirname,"public")));

const questions=[
["Um elemento químico é identificado principalmente pelo seu número de...",["nêutrons","prótons","elétrons","camadas"],1],
["O número atômico (Z) corresponde à quantidade de...",["prótons","nêutrons","prótons + nêutrons","camadas eletrônicas"],0],
["Em um átomo neutro, o número de prótons é igual ao número de...",["nêutrons","elétrons","camadas","elementos"],1],
["Se um átomo possui Z = 8, qual é o elemento químico?",["Carbono","Nitrogênio","Oxigênio","Flúor"],2],
["Qual é o número atômico do sódio (Na)?",["9","10","11","12"],2],
["Um átomo possui 12 prótons e 12 elétrons. Qual é seu número atômico?",["6","12","24","36"],1],
["Um átomo possui 11 prótons e 12 nêutrons. Qual é seu número de massa (A)?",["11","12","22","23"],3],
["O que você consulta na Tabela Periódica para descobrir a identidade de um elemento?",["Número atômico","Cor","Quantidade de letras","Tamanho do símbolo"],0],
["Qual é o símbolo químico do oxigênio?",["O","Ox","Og","Os"],0],
["Qual é o símbolo químico do sódio?",["So","Sd","Na","S"],2],
["Um átomo neutro possui 17 elétrons. Quantos prótons ele possui?",["16","17","18","34"],1],
["Na Tabela Periódica, os elementos são organizados em ordem crescente de...",["massa visual","número atômico","quantidade de letras","número de camadas apenas"],1]
].map(x=>({text:x[0],options:x[1],answer:x[2]}));

const rooms=new Map();
const clean=s=>String(s||"").trim().slice(0,24);
function code(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let x;do{x=[0,1,2,3,4].map(()=>c[Math.floor(Math.random()*c.length)]).join("")}while(rooms.has(x));return x}
function pub(r){return {code:r.code,teacher:r.teacher,started:r.started,students:[...r.students.values()].map(s=>({name:s.name,score:s.score,answered:s.answered})),totalQuestions:questions.length}}
function emit(r){io.to(r.code).emit("room:update",pub(r));}
function rank(r){io.to(r.code).emit("ranking:update",[...r.students.values()].map(s=>({name:s.name,score:s.score})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)));}

io.on("connection",s=>{
s.on("teacher:create",({name})=>{name=clean(name);if(!name)return s.emit("error:message","Digite seu nome.");let c=code(),r={code:c,teacher:name,teacherSocket:s.id,started:false,qi:-1,students:new Map()};rooms.set(c,r);s.join(c);s.data={role:"teacher",code:c};s.emit("teacher:created",{code:c,teacher:name});emit(r);});
s.on("teacher:open",()=>{let r=rooms.get(s.data.code);if(r)s.emit("teacher:panel",pub(r));});
s.on("student:join",({name,code:c})=>{name=clean(name);c=String(c||"").trim().toUpperCase();let r=rooms.get(c);if(!name)return s.emit("error:message","Digite seu nome.");if(!r)return s.emit("error:message","Sala não encontrada.");if(r.started)return s.emit("error:message","A missão já começou.");if([...r.students.values()].some(x=>x.name.toLowerCase()===name.toLowerCase()))return s.emit("error:message","Esse nome já está na sala.");r.students.set(s.id,{name,score:0,answered:false});s.join(c);s.data={role:"student",code:c};s.emit("student:joined",{code:c,name});emit(r);rank(r);});
s.on("teacher:start",()=>{let r=rooms.get(s.data.code);if(!r||r.teacherSocket!==s.id)return;r.started=true;r.qi=0;r.students.forEach(x=>x.answered=false);io.to(r.code).emit("question",{index:0,total:questions.length,q:questions[0]});emit(r);});
s.on("student:answer",({option})=>{let r=rooms.get(s.data.code),st=r&&r.students.get(s.id);if(!r||!st||!r.started||st.answered)return;st.answered=true;let q=questions[r.qi],ok=Number(option)===q.answer;if(ok)st.score+=100;s.emit("result",{ok});emit(r);rank(r);});
s.on("teacher:next",()=>{let r=rooms.get(s.data.code);if(!r||r.teacherSocket!==s.id)return;r.qi++;if(r.qi>=questions.length){r.started=false;io.to(r.code).emit("finished");emit(r);rank(r);return}r.students.forEach(x=>x.answered=false);io.to(r.code).emit("question",{index:r.qi,total:questions.length,q:questions[r.qi]});emit(r);});
s.on("teacher:restart",()=>{let r=rooms.get(s.data.code);if(!r||r.teacherSocket!==s.id)return;r.started=false;r.qi=-1;r.students.clear();io.to(r.code).emit("reset");emit(r);});
s.on("disconnect",()=>{let r=rooms.get(s.data.code);if(!r)return;if(r.teacherSocket===s.id){io.to(r.code).emit("closed");rooms.delete(r.code)}else{r.students.delete(s.id);emit(r);rank(r)}})
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
server.listen(PORT,"0.0.0.0",()=>console.log("Servidor ativo na porta "+PORT));
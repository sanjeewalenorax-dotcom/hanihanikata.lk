const express=require('express');
const cors=require('cors');
const path=require('path');
const Database=require('better-sqlite3');
const app=express(); app.use(cors()); app.use(express.json());
const db=new Database('hanihanikata.db');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,email TEXT UNIQUE,role TEXT DEFAULT 'user',verified INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ads(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,title TEXT,description TEXT,category TEXT,city TEXT,district TEXT,price REAL,condition TEXT,status TEXT DEFAULT 'pending',ai_score REAL DEFAULT 0,views INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,ad_id INTEGER,amount REAL,status TEXT,provider TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT,ad_id INTEGER,user_id INTEGER,reason TEXT,status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT,target_type TEXT,target_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
app.use(express.static(path.join(__dirname,'public')));

app.get('/api/health',(req,res)=>res.json({ok:true,service:'හනිහනිකට.lk'}));
app.get('/api/ads',(req,res)=>{
 const {q,category,city,maxPrice,status='approved'}=req.query;
 let sql='SELECT * FROM ads WHERE status=?'; let p=[status];
 if(q){sql+=' AND (title LIKE ? OR description LIKE ?)'; p.push('%'+q+'%','%'+q+'%')}
 if(category){sql+=' AND category=?';p.push(category)}
 if(city){sql+=' AND city=?';p.push(city)}
 if(maxPrice){sql+=' AND price<=?';p.push(Number(maxPrice))}
 sql+=' ORDER BY created_at DESC';
 res.json(db.prepare(sql).all(...p));
});
app.post('/api/ads',(req,res)=>{
 const {user_id=1,title,description,category,city,district,price,condition='Used'}=req.body;
 if(!title||!category||price==null) return res.status(400).json({error:'title, category and price are required'});
 const r=db.prepare(`INSERT INTO ads(user_id,title,description,category,city,district,price,condition,status) VALUES(?,?,?,?,?,?,?,?,?)`)
 .run(user_id,title,description||'',category,city||'',district||'',Number(price),condition,'pending');
 res.status(201).json({id:r.lastInsertRowid,status:'pending',message:'AI check + Admin approval required'});
});
app.get('/api/admin/summary',(req,res)=>{
 const count=t=>db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
 const revenue=db.prepare("SELECT COALESCE(SUM(amount),0) total FROM payments WHERE status='paid'").get().total;
 res.json({users:count('users'),ads:count('ads'),pendingAds:db.prepare("SELECT COUNT(*) c FROM ads WHERE status='pending'").get().c,approvedAds:db.prepare("SELECT COUNT(*) c FROM ads WHERE status='approved'").get().c,reports:count('reports'),agents:db.prepare("SELECT COUNT(*) c FROM users WHERE role='agent'").get().c,revenue});
});
app.post('/api/admin/ads/:id/approve',(req,res)=>{
 const r=db.prepare("UPDATE ads SET status='approved' WHERE id=?").run(req.params.id);
 res.json({updated:r.changes});
});
app.post('/api/admin/ads/:id/reject',(req,res)=>{
 const r=db.prepare("UPDATE ads SET status='rejected' WHERE id=?").run(req.params.id);
 res.json({updated:r.changes});
});
app.listen(3000,()=>console.log('http://localhost:3000'));

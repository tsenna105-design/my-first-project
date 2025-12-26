const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'data.json');

function readData(){
  try{ return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }catch(e){ return { nextId: 1, shoes: [], orders: [] }; }
}
function writeData(d){ fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)); }

function sendJSON(res, obj, status=200){ res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

function collectBody(req, cb){
  let body = '';
  req.on('data', c => body += c.toString());
  req.on('end', () => {
    try{ cb(null, body ? JSON.parse(body) : {}); }catch(e){ cb(e); }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/')){
    const data = readData();
    if(req.method === 'GET' && url.pathname === '/api/shoes'){ sendJSON(res, data.shoes); return; }
    if(req.method === 'GET' && url.pathname === '/api/orders'){ sendJSON(res, data.orders); return; }

    if(req.method === 'POST' && url.pathname === '/api/shoes'){
      collectBody(req, (err, body) => {
        if(err){ sendJSON(res, { error: 'Invalid JSON' }, 400); return; }
        if(!body.title || body.price == null){ sendJSON(res, { error: 'title and price required' }, 400); return; }
        const shoe = {
          id: data.nextId++,
          title: String(body.title),
          price: Number(body.price) || 0,
          size: body.size || '',
          image: body.image || '',
          desc: body.desc || '',
          sold: false,
          createdAt: new Date().toISOString()
        };
        data.shoes.push(shoe);
        writeData(data);
        sendJSON(res, shoe, 201);
      });
      return;
    }

    if(req.method === 'POST' && url.pathname === '/api/purchase'){
      collectBody(req, (err, body) => {
        if(err){ sendJSON(res, { error: 'Invalid JSON' }, 400); return; }
        const id = Number(body.id);
        const shoe = data.shoes.find(s => s.id === id);
        if(!shoe){ sendJSON(res, { error: 'shoe not found' }, 404); return; }
        if(shoe.sold){ sendJSON(res, { error: 'already sold' }, 400); return; }
        shoe.sold = true;
        const order = {
          orderId: data.nextId++,
          shoeId: shoe.id,
          title: shoe.title,
          price: shoe.price,
          buyer: body.buyer || 'anon',
          createdAt: new Date().toISOString()
        };
        data.orders.push(order);
        writeData(data);
        sendJSON(res, order, 201);
      });
      return;
    }

    sendJSON(res, { error: 'not found' }, 404);
    return;
  }

  // static file serve
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  fs.readFile(filePath, (err, content) => {
    if(err){ res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const map = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

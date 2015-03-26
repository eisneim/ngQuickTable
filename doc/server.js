var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs');

var port = 8080;

http.createServer(function(req,res){

	req.parsed_url = url.parse(req.url,true);
	var core_url = req.parsed_url.pathname == '/'?'index.html': req.parsed_url.pathname.substr(1);

	var rs = fs.createReadStream( core_url );
	var ct = getContentType(core_url);
	
	rs.on('error',function(){
		// res.writeHead(404,{'Content-Type':'text/plain'});
		// res.end('not found');
		rs = fs.createReadStream( 'index.html' );
		res.writeHead(200,{'Content-Type':'text/html'});
		rs.pipe(res);	
	})

	res.writeHead(200,{'Content-Type':ct});

	rs.pipe(res);

	console.log("[90m"+core_url+'[39m');

}).listen(port);
console.log('dev file server listening on port: '+port);

function getContentType(filename){
	var ext = path.extname(filename).toLowerCase();

	switch(ext){
		case '.jpg': case '.jpeg': 
			return 'image/jpeg'
		case '.png':
			return 'image/png'; 
		case '.gif':
			return 'image/gif';
		case '.html':
			return 'text/html';
		case '.js':
			return 'text/javascript';
		case '.css' :
			return 'text/css';
		default:
			return 'text/plain';

	}
}

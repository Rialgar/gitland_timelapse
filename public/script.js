const onLoad = async () => {
    const heightAdjustment = document.getElementById('controls').clientHeight;
    let size = 0;
    const canvas = document.getElementById("canvas");

    const resize = () => {
        const width = document.documentElement.clientWidth;
        const height = document.documentElement.clientHeight;
        size = Math.min(width, height - heightAdjustment);
        canvas.style.width = size + "px";
        canvas.style.height = size + "px"
    };

    window.addEventListener("resize", resize);
    resize();

    const data = await (await fetch("./mapData")).text();
    const lines = data.split("\n");
    const maps = [];

    {
        let width = 0;
        let latestUnparsed = '';
        
        lines.forEach(line => {
            if(line.startsWith(String.fromCharCode(1))){
                width = parseInt(line.substring(1));
                return;
            } else if(line.startsWith(String.fromCharCode(2))) {
                latestUnparsed = line.substring(1);
            } else {
                latestUnparsed = applyDiff(latestUnparsed, line);
            }
            maps.push(parseMap(latestUnparsed, width));
        });
    }

    document.getElementById('range').max = maps.length;

    let currentMap = 0;
    const drawMap = () => {        
        const map = maps[currentMap];
        const width = map[0].length;
        const height = map.length;

        canvas.height = height;
        canvas.width = width;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);

        for(let y = 0; y < map.length; y++){
            for(let x = 0; x < width; x++){
                const base = 4*(y*width + x);
                imageData.data[base+3] = 255; //alpha

                imageData.data[base] = 0;
                imageData.data[base+1] = 0;
                imageData.data[base+2] = 0;
                switch(map[y][x]){
                    case 'r':
                    case 'R':
                        imageData.data[base] = 255;
                        break;
                    case 'g':
                    case 'G':
                        imageData.data[base+1] = 255;
                        break;
                    case 'b':
                    case 'B':
                        imageData.data[base+2] = 255;
                        break;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        document.getElementById('counter').textContent = (currentMap+1) + "/" + maps.length;
        document.getElementById('range').value = currentMap+1;
    }

    let stopped = false;
    const frame = () => {
        if(stopped){
            return;
        }
        drawMap();        
        currentMap++;
        if(currentMap < maps.length){
            window.requestAnimationFrame(frame);
        }
    }
    window.requestAnimationFrame(frame);
    

    document.getElementById('range').addEventListener('mousedown', () => {
        stopped = true;
    });
    document.getElementById('range').addEventListener('mouseup', () => {
        stopped = false;
        window.requestAnimationFrame(frame);
    });

    document.getElementById('range').addEventListener('input', () => {
        console.log(document.getElementById('range').value);
        currentMap = parseInt(document.getElementById('range').value);
        drawMap();
    });
}

const applyDiff = (latestUnparsed, line) => {    
    let out = latestUnparsed;
    for(let i = 0; i < line.length; i += 2){
        const position = line.charCodeAt(i)-20;
        const symbol = line[i+1];
        out = out.substring(0, position) + symbol + out.substring(position+1);
    }
    if(out.length !== latestUnparsed.length){
        debugger;
    }
    return out;
}

const parseMap = (line, width) => {
    const out = [];
    const toCoords = index => ({
        x: index % width,
        y: (index - (index%width))/width
    })
    const setField = ({x, y}, state) => {
        if(!out[y]){
            out[y] = []
        }
        out[y][x] = state;
    }
    for(let i = 0; i < line.length; i++){
        setField(toCoords(i), line[i]);
    }
    return out;
}

switch (document.readyState) {
    case "loading":
        window.addEventListener("load", onLoad);
        break;
    case "interactive":
    case "complete":
        onLoad();
        break;
}
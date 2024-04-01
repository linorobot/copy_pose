let globalYamlData = null;
let firstClick = null;
let secondClick = null;
let firstPos = null;
let secondPos = null;

function dragOverHandler(ev) {
    ev.preventDefault(); 
}

function dropHandler(ev) {
    ev.preventDefault();

    let files = ev.dataTransfer.files;
    if (files.length !== 2) {
        alert("Please drop exactly two files: one image and one YAML file.");
        return;
    }

    let yamlFile = null;
    let imageFile = null;

    for (const file of files) {
        if (file.type === "text/yaml" || file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
            yamlFile = file;
        } else if (file.type.startsWith('image/')) {
            imageFile = file;
        }
    }

    if (!yamlFile || !imageFile) {
        alert("Please make sure to drop one YAML file and one image file.");
        return;
    }

    let reader = new FileReader();
    reader.onload = function(event) {
        try {
            let doc = jsyaml.load(event.target.result);
            if (doc && doc.image) {
                globalYamlData = jsyaml.load(event.target.result);

                displayImage(imageFile);
            } else {
                alert("The YAML file does not reference an image.");
            }
        } catch (e) {
            alert("Failed to parse the YAML file.");
        }
    };
    reader.readAsText(yamlFile);
}

function displayImage(file) {
    let reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            document.getElementById('drop_area').innerHTML = '';
            document.getElementById('drop_area').appendChild(canvas);

            mouseEvents(canvas, ctx, img);
        };
    };
    reader.readAsDataURL(file);
}

function mouseEvents(canvas, ctx, img) {
    drawAxis(ctx, globalYamlData.resolution, globalYamlData.origin, img.width, img.height);

    canvas.addEventListener('click', function(event) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const clickPos = {
            x: ((mouseX / canvas.width) * img.width),
            y: ((mouseY / canvas.height) * img.height)
        };
        const posX = (clickPos.x * globalYamlData.resolution) + globalYamlData.origin[0];
        const posY = ((img.height - clickPos.y) * globalYamlData.resolution) + globalYamlData.origin[1];

        if (firstClick === null) {
            firstClick = clickPos;
            firstPos = {
                x: posX,
                y: posY
            };

            drawArrow(ctx, firstClick, firstClick);

        } else if (secondClick === null) {
            secondClick = clickPos;
            secondPos = {
                x: posX,
                y: posY
            };

            const x = firstPos.x.toFixed(3);
            const y = firstPos.y.toFixed(3);
            const yaw = calculateOrientation(firstPos, secondPos);
        

            yaw_px = calculateOrientation(firstClick, secondClick);
            end_x = firstClick.x + ((1.5 / globalYamlData.resolution) * Math.cos(yaw_px));
            end_y = firstClick.y + ((1.5 / globalYamlData.resolution) * Math.sin(yaw_px));

            drawArrow(ctx, firstClick, {x: end_x, y: end_y}, 'blue');
            firstClick = null;
            secondClick = null;

            const poseString = `x: ${x}, y: ${y}, yaw: ${yaw.toFixed(4)}`;
            navigator.clipboard.writeText(`{ ${poseString} }`);

            showToast(`${poseString} added to clipboard!`);
            console.log(`{${x}, ${y}, ${yaw}}`);
        }
    });

    canvas.addEventListener('mousemove', function(event) {
        if (firstClick !== null && secondClick === null) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const mousePos = {
                x: (mouseX / canvas.width) * img.width,
                y: (mouseY / canvas.height) * img.height
            };

            yaw_px = calculateOrientation(firstClick, mousePos)
            end_x = firstClick.x + ((1.5 / globalYamlData.resolution) * Math.cos(yaw_px))
            end_y = firstClick.y + ((1.5 / globalYamlData.resolution) * Math.sin(yaw_px))

            drawArrow(ctx, firstClick,  {x: end_x, y: end_y}, 'blue');
            drawAxis(ctx, globalYamlData.resolution, globalYamlData.origin, img.width, img.height);
        }
    });
}

function drawArrow(ctx, from, to, color = 'rgba(0, 0, 255, 0.8)') {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - 10 * Math.cos(angle - Math.PI / 6), to.y - 10 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - 10 * Math.cos(angle + Math.PI / 6), to.y - 10 * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(to.x, to.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function calculateOrientation(firstPoint, secondPoint) {
    const deltaY = secondPoint.y - firstPoint.y;
    const deltaX = secondPoint.x - firstPoint.x;
    return Math.atan2(deltaY, deltaX);
}

function drawAxis(ctx, resolution, origin, imgWidth, imgHeight) {
    const x_offset = origin[0]  / resolution;
    const y_offset = origin[1]  / resolution;
    const originX = -x_offset
    const originY = imgHeight + y_offset
    const xAxisEnd = originX + (2.5 / resolution);
    const yAxisEnd = originY - (2.5 / resolution);

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(xAxisEnd, originY);
    ctx.stroke();

    ctx.strokeStyle = 'green';
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, yAxisEnd);
    ctx.stroke();
}

function showToast(text) {
    var toast = document.getElementById("toast");
    toast.innerHTML = text;
    toast.classList.add("show");
    setTimeout(function(){
        toast.classList.remove("show");
    }, 10000);
    toastShown = true;
}
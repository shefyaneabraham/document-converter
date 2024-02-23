const express = require('express');
const multer = require('multer');

const bodyParser = require('body-parser');

const X2JS = require('x2js');

const app = express();

app.use(bodyParser.json());

const storage = multer.memoryStorage()
const upload = multer({ storage });

function x12ToJson(x12Data,lineSeparator,elemSeparator) {
    const segments = x12Data.split(lineSeparator).filter(Boolean); // Split by segment delimiter and remove empty segments
    const json = {};

    segments.forEach(segment => {
        const [segmentId, ...elements] = segment.split(elemSeparator);
        const segmentObject = {};

        elements.forEach((element, index) => {
            segmentObject[`${segmentId}${index + 1}`] = element;
        });

        // Check if segmentId already exists
        if (json[segmentId]) {
            // If it does, check if it's already an array
            if (!Array.isArray(json[segmentId])) {
                // If not, convert it into an array and push the existing object
                const existingSegment = json[segmentId];
                json[segmentId] = [existingSegment];
            }
            // Push the current segment object into the array
            json[segmentId].push(segmentObject);
        } else {
            // If the segmentId doesn't exist, add it to the JSON object
            json[segmentId] = segmentObject;
        }
    });

    return json;
}

function jsonToX12(jsonData,lineSeparator,elemSeparator) {
    let txtData = '';

    for (const key in jsonData) {
        // Check if the value corresponding to the key is an array
        if (Array.isArray(jsonData[key])) {
            for (const item of jsonData[key]) {
                // Convert the object values of each item into an array
                const itemValues = Object.values(item);
                
                txtData += key + `${elemSeparator}`;
                txtData += itemValues.join(elemSeparator) + `${lineSeparator}`;
            
            }
        } else {
            const values = Object.values(jsonData[key]);
            txtData += key +`${elemSeparator}`;
            txtData += values.join(elemSeparator) + `${lineSeparator}`;
        }
    }
    return txtData
}

function jsonToXml(jsonData){
    const x2js = new X2JS({keepCData:false})
    const xml = x2js.js2xml(jsonData)
    return xml
}

function xmlToJson(xmlData){

    const x2js = new X2JS({keepText:false, keepCData: false})
    let json = x2js.xml2js(xmlData)
    
    json = json.root
    //removing '__text'
    for (let key in json) {
        if (typeof json[key] === 'object' && json[key].hasOwnProperty('__text')) {
            json[key] = "";
        } else if (typeof json[key] === 'object') {
            for (let subKey in json[key]) {
                if (typeof json[key][subKey] === 'object' && json[key][subKey].hasOwnProperty('__text')) {
                    json[key][subKey] = "";
                }
            }
        }
    }
    
    return json
}

app.post('/conversion', upload.single('file'), (req, res) => {
    // Check if file exists
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.file
    
    let result
    switch (req.body.format) {
        case 'x12ToJson': {
            let lineSeparator = req.body.lineSeparator
            let elemSeparator = req.body.elemSeparator

            if(!lineSeparator || !elemSeparator){
                return res.status(400).json({ error: 'No separator characters were specified' });
            }

            let multerText = Buffer.from(file.buffer).toString("utf-8")
            multerText = multerText.replace(/\s+/g,' ').trim(); // removing extra spaces
            result = x12ToJson(multerText, lineSeparator, elemSeparator);
        }
            break;
        case 'jsonToX12': {
            let lineSeparator = req.body.lineSeparator
            let elemSeparator = req.body.elemSeparator

            if(!lineSeparator || !elemSeparator){
                return res.status(400).json({ error: 'No separator characters were specified' });
            }

            const jsonData = JSON.parse(req.file.buffer.toString());
            result = jsonToX12(jsonData, lineSeparator, elemSeparator)
        }
            break;
        case 'jsonToXml': {
            const jsonData = JSON.parse(req.file.buffer.toString());
            result = jsonToXml(jsonData)
            res.setHeader("Content-Type", 'text/xml');
        }
            break;
        case 'xmlToJson': {
            const xmlData = req.file.buffer.toString();
            result = xmlToJson(xmlData)
        }
            break;
        case 'xmlToX12': {
            let lineSeparator = req.body.lineSeparator
            let elemSeparator = req.body.elemSeparator
            
            if(!lineSeparator || !elemSeparator){
                return res.status(400).json({ error: 'No separator characters were specified' });
            }

            const xmlData = req.file.buffer.toString();
            json = xmlToJson(xmlData)
            result = jsonToX12(json,lineSeparator, elemSeparator)
        
        }
            break;
        case 'x12ToXml': {
            let lineSeparator = req.body.lineSeparator
            let elemSeparator = req.body.elemSeparator

            if(!lineSeparator || !elemSeparator){
                return res.status(400).json({ error: 'No separator characters were specified' });
            }

            let multerText = Buffer.from(file.buffer).toString("utf-8")
            multerText = multerText.replace(/\s+/g,' ').trim(); // removing extra spaces
            json = x12ToJson(multerText, lineSeparator, elemSeparator);
            result = jsonToXml(json)
        }
            break;
        default:
            return res.status(400).json({ error: 'Sorry, we are out of format.' });
    }
    res.send(result);

})

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
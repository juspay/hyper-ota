#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mustache from 'mustache';
import { Command } from "commander";

async function startBuilder(namespace, service, modelsJSON, clientPath, endpointURL, nModule, nModuleVersion, cliName, cliDescription) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);

    const servicePath = `${namespace}#${service}`
    const serviceName = servicePath.split("#")[1]

    var obj;

    const convertSmithyTypeToCliType = (type) => {
        return type.split("#")[1]
    }

    const generateImports = (ops) => {
        let imports = []
        for(let i = 0; i < ops.length; i++){
            imports.push(ops[i].opName + "Command");
        }
        
        return imports.join(', ')
    }

    const generateParamDocs = (params) => {
        let paramDocs = ""
        let fileInputKey = getFileUploadInputKey(params)
        if(fileInputKey != null) paramDocs += `\nfilePath=<String>`
        for(let i = 0; i < params.length; i++){
            if(fileInputKey == params[i].name) continue;
            paramDocs += `\n${params[i].name}=<${params[i].type}>`
        }
        return paramDocs
    }

    const isAuthAPI = (traits) => {
        if(traits[`${namespace}#authapi`]) return true
        return false
    }

    const requiresAuth = (traits) => {
        if(traits[`${namespace}#requiresauth`]) return true
        return false
    }

    const isFileUpload = (inputs) => {
        for(let i = 0; i < inputs.length; i++){
            if(inputs[i].type == "FileStream"){
                return true;
            }
        }
        return false;
    }

    const getFileUploadInputKey = (inputs) => {
        for(let i = 0; i < inputs.length; i++){
            if(inputs[i].type == "FileStream"){
                return inputs[i].name;
            }
        }
        return null;
    }

    let data = await fs.readFile(modelsJSON, { encoding: 'utf8' });
        
    await (async (err, data) => {
        if (err) throw err;
        obj = JSON.parse(data);
        let operations = obj["shapes"][`${namespace}#${service}`]["operations"];
        operations = operations.map((val) => val.target)
        // console.log(operations)

        let commands = []

        for(let i = 0; i < operations.length; i++){
            let op = operations[i]
            let opBody = obj["shapes"][op]
            let opInputTarget = opBody["input"]["target"]
            let opOutputTarget = opBody["output"]["target"]
            let opInputTargetName = opBody["input"]["target"].split("#")[1]
            let opOutputTargetName = opBody["output"]["target"].split("#")[1]

            let opInputShape = obj["shapes"][opInputTarget]
            let opOutputShape = obj["shapes"][opOutputTarget]
            // console.log("g",opInputShape)
            // if(i == 1) console.log(opBody)

            let cliOperation = {}

            cliOperation.opName = op.split("#")[1]
            cliOperation.name = opBody["traits"]["smithy.api#http"]["uri"]
            cliOperation.uri = opBody["traits"]["smithy.api#http"]["uri"]
            cliOperation.description = opBody["traits"]["smithy.api#documentation"]
            cliOperation.opInputTargetName = opInputTargetName
            cliOperation.opOutputTargetName = opOutputTargetName
            cliOperation.traits = opBody["traits"]
            
            cliOperation.inputs = []
            cliOperation.outputs = []
            
            if(opInputShape){
                for (let [key, value] of Object.entries(opInputShape["members"])) {
                    cliOperation.inputs.push({
                        name: key,
                        type: convertSmithyTypeToCliType(value["target"])
                    });
                }
            }
        
            if(opOutputShape){
                for (let [key, value] of Object.entries(opOutputShape["members"])) {
                    cliOperation.outputs.push({
                        name: key,
                        type: convertSmithyTypeToCliType(value["target"])
                    });
                }
            }

            commands.push(cliOperation)
        }

        // Create the source code

        const projectDir = path.join(__dirname, 'build');
        const srcDir = path.join(__dirname, 'build');
        const packageJsonFilePath  = path.join(projectDir, 'package.json');
        const indexFilePath  = path.join(srcDir, 'index.js');

        await fs.mkdir(projectDir, { recursive: true });
        const templatePackage = await fs.readFile('./templates/package.json.tmpl', { encoding: 'utf8' });
        const outputPackage = mustache.render(templatePackage, {
            otaClientLocation: clientPath,
            otaCLIName: cliName.toLowerCase().replace(" ", "-"),
            packageVersion: nModuleVersion
        });
        console.log("Writing package.json")
        await fs.writeFile(packageJsonFilePath, outputPackage, 'utf-8')
        console.log("Generated package.json")

        await fs.mkdir(srcDir, { recursive: true })

        let codeBlocks = []

        // header
        const imports = generateImports(commands)
        const templateHeader = await fs.readFile('./templates/header.js.tmpl', { encoding: 'utf8' });
        const outputHeader = mustache.render(templateHeader, {
            imports: imports,
            importFrom: nModule,
            client: serviceName + "Client",
            endpointURL: endpointURL,
            cliName: cliName,
            cliDescription: cliDescription,
            cliVersion: nModuleVersion
        });

        codeBlocks.push(outputHeader)

        for(let i = 0; i < commands.length; i++){
            const templateCommand = await fs.readFile(
                isFileUpload(commands[i].inputs) ? './templates/command.withFileUpload.js.tmpl' : './templates/command.js.tmpl'
            , { encoding: 'utf8' });
            const outputCommand = mustache.render(templateCommand, {
                cmd: commands[i].opName + "Command",
                actionName: commands[i].opName,
                paramDocs: generateParamDocs(commands[i].inputs),
                inputTypes: JSON.stringify(commands.inputs)
            });
            codeBlocks.push(outputCommand)
        }

        //footer
        const templateFooter = await fs.readFile('./templates/footer.js.tmpl', { encoding: 'utf8' });
        const outputFooter = mustache.render(templateFooter, {});
        codeBlocks.push(outputFooter)

        console.log("Writing index.js")
        await fs.writeFile(indexFilePath, codeBlocks.join('\n\n'), 'utf-8')
        console.log("Generated index.js")
        
        // console.log(commands)
    })(null, data)

}

function parseParams(params) {
    return params.reduce((acc, kv) => {
        const [key, val] = kv.split('=');
        if (!key || val === undefined) {
            console.error(`Invalid parameter: ${kv}. Expected key=value.`);
            process.exit(1);
        }
        acc[key] = val;
        return acc;
    }, {});
}

const program = new Command();

program
    .name('juspay-cli-builder')
    .description('Juspay CLI Builder => A CLI builder that builds a CLI on top of Smithy Client')
    .usage('[params...]')
    .argument('[params...]', 'parameters in key=value form: endpointUrl=<string> smithyProjectPath=<string> cliName=<string> cliDescription=<string>')
    .action(async (params = []) => {
        const options = parseParams(params);
        try{

            if (
                !options.endpointUrl ||
                !options.smithyProjectPath ||
                !options.cliName ||
                !options.cliDescription
            ){
                console.error('Missing required parameters. Expected: endpointUrl, smithyProjectPath, cliName, cliDescription');
                process.exit(1);
            }
    
            const smithyProjectPath = options.smithyProjectPath;
            const smithyBuildJSONFile = smithyProjectPath + "smithy-build.json"
            const smithyBuildJSON = await fs.readFile(smithyBuildJSONFile, { encoding: 'utf8' });
            const smithyBuildObj = JSON.parse(smithyBuildJSON);
            const namespace = smithyBuildObj["projections"]["typescript-sdk"]["plugins"]["typescript-codegen"]["service"].split("#")[0]
            const service = smithyBuildObj["projections"]["typescript-sdk"]["plugins"]["typescript-codegen"]["service"].split("#")[1]
            const endpointURL = options.endpointUrl;
            const nModule = smithyBuildObj["projections"]["typescript-sdk"]["plugins"]["typescript-codegen"]["package"]
            const nModuleVersion = smithyBuildObj["projections"]["typescript-sdk"]["plugins"]["typescript-codegen"]["packageVersion"]
            const clientPath = smithyProjectPath + "build/smithy/typescript-sdk/typescript-codegen/"
            const modelsJSON = smithyProjectPath + "build/smithy/typescript-sdk/model/model.json"
    
            console.log('Invoking CLI builder with:', {
                namespace,
                service,
                modelsJSON,
                clientPath,
                endpointURL,
                nModule,
                nModuleVersion,
            });
    
            await startBuilder(
                namespace,
                service,
                modelsJSON,
                clientPath,
                endpointURL,
                nModule,
                nModuleVersion,
                options.cliName,
                options.cliDescription
            );
            process.exit(0)
        }catch(err){
            console.log("Error while building: ", err, "\n\nPossible fixes: Build your smithy project before running this, check smithy project url")
            process.exit(1)
        }

    });

program.parse(process.argv);
const winstaller = require('electron-winstaller');
const path = require('path');

async function build() {
    const rootPath = __dirname;
    const outPath = path.join(rootPath, 'dist-installer');
    const appPath = path.join(rootPath, 'dist-packager/SoulLauncher-win32-x64');
    const iconPath = path.join(rootPath, 'assets/icons/MrSoul-icon.ico');

    console.log('Building installer...');
    console.log('Output directory:', outPath);
    console.log('App directory:', appPath);

    try {
        await winstaller.createWindowsInstaller({
            appDirectory: appPath,
            outputDirectory: outPath,
            authors: 'MrSoul',
            exe: 'SoulLauncher.exe',
            setupExe: 'SoulLauncher-Setup.exe',
            noMsi: true,
            description: 'Soul Launcher - Minecraft Launcher with Admin Panel',
            productName: 'Soul Launcher',
            setupIcon: iconPath,
            iconUrl: 'https://raw.githubusercontent.com/MrSoul/MrSoulxLauncher/main/assets/icons/MrSoul-icon.ico', // Placeholder URL
            loadingGif: undefined // You can add a gif here if you want
        });
        console.log('Successfully created installer in dist-installer folder!');
    } catch (e) {
        console.error('Error creating installer:', e.message);
        process.exit(1);
    }
}

build();

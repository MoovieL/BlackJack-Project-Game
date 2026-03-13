/* ===================================================================
   BLACKJACK ROYAL - 3D Casino Lobby (Three.js)
   Full casino interior with animated characters, slot machines,
   tables, and smooth camera transition to blackjack table.
   =================================================================== */

(function () {
    'use strict';

    // ---------------------------------------------------------------
    // SCENE SETUP
    // ---------------------------------------------------------------
    const canvas = document.getElementById('lobby-canvas');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 8, 22);
    camera.lookAt(0, 3, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.outputEncoding = THREE.sRGBEncoding;

    // ---------------------------------------------------------------
    // COLORS & MATERIALS
    // ---------------------------------------------------------------
    const COLORS = {
        carpet:     0x1a0a2e,
        carpetAlt:  0x150828,
        wall:       0x1c1028,
        wallTrim:   0xc8a45c,
        ceiling:    0x0f0a1e,
        felt:       0x0d6b3b,
        feltDark:   0x094d2a,
        wood:       0x3e2216,
        woodLight:  0x5a3422,
        gold:       0xc8a45c,
        goldBright: 0xe8cc7a,
        neonRed:    0xff1744,
        neonBlue:   0x2979ff,
        neonPurple: 0xaa00ff,
        neonGreen:  0x00e676,
        neonPink:   0xff4081,
        chrome:     0x888888,
        black:      0x111111,
        skin1:      0xf4c89a,
        skin2:      0xd4a06a,
        skin3:      0x8d5e3c,
        shirt1:     0xc0392b,
        shirt2:     0x2980b9,
        shirt3:     0x8e44ad,
        shirt4:     0x27ae60,
        shirt5:     0xf39c12,
        dress1:     0xe74c3c,
        dress2:     0x1abc9c,
    };

    const materials = {};

    function mat(color, opts = {}) {
        const key = color + JSON.stringify(opts);
        if (materials[key]) return materials[key];
        const m = new THREE.MeshStandardMaterial({
            color, roughness: opts.rough ?? 0.7, metalness: opts.metal ?? 0.0,
            emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
            side: opts.side ?? THREE.FrontSide
        });
        materials[key] = m;
        return m;
    }

    function glowMat(color, intensity = 1) {
        return mat(color, { emissive: color, emissiveIntensity: intensity, rough: 0.3 });
    }

    // ---------------------------------------------------------------
    // LIGHTING
    // ---------------------------------------------------------------
    // Ambient - very dim warm
    const ambient = new THREE.AmbientLight(0x1a1025, 0.4);
    scene.add(ambient);

    // Main overhead warm spots
    function addSpot(x, y, z, target, color = 0xffe0a0, intensity = 1.5, angle = 0.6) {
        const light = new THREE.SpotLight(color, intensity, 40, angle, 0.5, 1.5);
        light.position.set(x, y, z);
        light.target.position.set(target[0], target[1], target[2]);
        light.castShadow = true;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        scene.add(light);
        scene.add(light.target);
        return light;
    }

    // Overhead lights for each area
    addSpot(0, 12, 0, [0, 0, 0], 0xffe0a0, 2, 0.8);       // Center
    addSpot(-12, 11, -5, [-12, 0, -5], 0xffcc80, 1.2, 0.5); // Left slots
    addSpot(12, 11, -5, [12, 0, -5], 0xffcc80, 1.2, 0.5);   // Right slots
    addSpot(0, 11, -10, [0, 0, -10], 0xffd090, 1.5, 0.6);   // Back poker
    addSpot(0, 10, 5, [0, 2, 5], 0xffe8c0, 1.8, 0.5);       // Blackjack table highlight

    // Colored accent lights
    const neonLight1 = new THREE.PointLight(0xff1744, 0.6, 15);
    neonLight1.position.set(-18, 6, 0);
    scene.add(neonLight1);

    const neonLight2 = new THREE.PointLight(0x2979ff, 0.6, 15);
    neonLight2.position.set(18, 6, 0);
    scene.add(neonLight2);

    const neonLight3 = new THREE.PointLight(0xaa00ff, 0.4, 20);
    neonLight3.position.set(0, 6, -18);
    scene.add(neonLight3);

    // ---------------------------------------------------------------
    // GEOMETRY HELPERS
    // ---------------------------------------------------------------
    function box(w, h, d, material, x = 0, y = 0, z = 0) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    function cylinder(rTop, rBot, h, material, x = 0, y = 0, z = 0, segments = 16) {
        const geo = new THREE.CylinderGeometry(rTop, rBot, h, segments);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    function sphere(r, material, x = 0, y = 0, z = 0) {
        const geo = new THREE.SphereGeometry(r, 12, 8);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        return mesh;
    }

    // ---------------------------------------------------------------
    // ROOM: Floor, Walls, Ceiling
    // ---------------------------------------------------------------
    function buildRoom() {
        const group = new THREE.Group();

        // Floor - carpet
        const floorGeo = new THREE.PlaneGeometry(50, 50);
        const floorMat = mat(COLORS.carpet, { rough: 0.95 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        group.add(floor);

        // Carpet pattern (decorative lines)
        for (let i = -20; i <= 20; i += 4) {
            const line = box(0.08, 0.01, 50, mat(COLORS.gold, { emissive: COLORS.gold, emissiveIntensity: 0.15 }), i, 0.01, 0);
            group.add(line);
        }
        for (let i = -20; i <= 20; i += 4) {
            const line = box(50, 0.01, 0.08, mat(COLORS.gold, { emissive: COLORS.gold, emissiveIntensity: 0.15 }), 0, 0.01, i);
            group.add(line);
        }

        // Walls
        const wallH = 14;
        const wallMaterial = mat(COLORS.wall, { rough: 0.85 });
        const wallTrimMat = mat(COLORS.wallTrim, { metal: 0.6, rough: 0.3 });

        // Back wall
        group.add(box(50, wallH, 0.5, wallMaterial, 0, wallH / 2, -25));
        group.add(box(50, 0.3, 0.6, wallTrimMat, 0, 3, -24.8)); // trim
        group.add(box(50, 0.15, 0.55, wallTrimMat, 0, wallH - 1, -24.8)); // top trim

        // Front wall (with opening)
        group.add(box(18, wallH, 0.5, wallMaterial, -16, wallH / 2, 25));
        group.add(box(18, wallH, 0.5, wallMaterial, 16, wallH / 2, 25));
        group.add(box(14, wallH - 5, 0.5, wallMaterial, 0, wallH - (wallH - 5) / 2, 25));

        // Left wall
        group.add(box(0.5, wallH, 50, wallMaterial, -25, wallH / 2, 0));
        group.add(box(0.6, 0.3, 50, wallTrimMat, -24.8, 3, 0));

        // Right wall
        group.add(box(0.5, wallH, 50, wallMaterial, 25, wallH / 2, 0));
        group.add(box(0.6, 0.3, 50, wallTrimMat, 24.8, 3, 0));

        // Ceiling
        const ceilMat = mat(COLORS.ceiling, { rough: 0.9 });
        group.add(box(50, 0.5, 50, ceilMat, 0, wallH, 0));

        // Ceiling panels/coffers
        for (let x = -20; x <= 20; x += 10) {
            for (let z = -20; z <= 20; z += 10) {
                group.add(box(9, 0.3, 9, mat(0x180e28, { rough: 0.8 }), x, wallH - 0.4, z));
                // Recessed light in each coffer
                const lg = new THREE.PointLight(0xffd090, 0.3, 12);
                lg.position.set(x, wallH - 0.8, z);
                group.add(lg);
                // Light fixture visual
                group.add(cylinder(0.4, 0.4, 0.15, glowMat(0xffeedd, 0.6), x, wallH - 0.6, z));
            }
        }

        // Wall sconces
        for (let z = -20; z <= 20; z += 8) {
            addWallSconce(group, -24.5, 5, z, 1);
            addWallSconce(group, 24.5, 5, z, -1);
        }

        // Columns
        for (let x = -15; x <= 15; x += 10) {
            addColumn(group, x, -20);
            addColumn(group, x, 20);
        }
        addColumn(group, -20, -10);
        addColumn(group, -20, 10);
        addColumn(group, 20, -10);
        addColumn(group, 20, 10);

        return group;
    }

    function addWallSconce(group, x, y, z, dir) {
        const arm = box(0.6, 0.08, 0.08, mat(COLORS.gold, { metal: 0.8, rough: 0.2 }), x + dir * 0.3, y, z);
        group.add(arm);
        const bulb = sphere(0.12, glowMat(0xffe0a0, 1.5), x + dir * 0.6, y, z);
        group.add(bulb);
        const light = new THREE.PointLight(0xffe0a0, 0.15, 6);
        light.position.set(x + dir * 0.6, y, z);
        group.add(light);
    }

    function addColumn(group, x, z) {
        const colMat = mat(0x252035, { rough: 0.6 });
        const trimMat = mat(COLORS.wallTrim, { metal: 0.7, rough: 0.2 });
        group.add(cylinder(0.5, 0.5, 14, colMat, x, 7, z, 8));
        group.add(cylinder(0.7, 0.7, 0.5, trimMat, x, 0.25, z, 8)); // base
        group.add(cylinder(0.7, 0.6, 0.5, trimMat, x, 13.75, z, 8)); // capital
    }

    // ---------------------------------------------------------------
    // BLACKJACK TABLE (center-front, main interactive)
    // ---------------------------------------------------------------
    const blackjackTablePos = new THREE.Vector3(0, 0, 5);
    let blackjackTableMesh;

    function buildBlackjackTable(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const woodMat = mat(COLORS.wood, { rough: 0.5, metal: 0.1 });
        const feltMat = mat(COLORS.felt, { rough: 0.9 });
        const rimMat = mat(COLORS.woodLight, { rough: 0.4, metal: 0.15 });
        const goldTrim = mat(COLORS.gold, { metal: 0.7, rough: 0.2 });

        // Table base
        group.add(cylinder(0.3, 0.4, 2.5, woodMat, 0, 1.25, 0));
        group.add(cylinder(1.2, 1.5, 0.3, woodMat, 0, 0.15, 0, 24));

        // Table top - semi-circular for blackjack
        const topShape = new THREE.Shape();
        topShape.moveTo(-3.5, 0);
        topShape.lineTo(-3.5, -1.5);
        topShape.quadraticCurveTo(-3.5, -3.5, 0, -3.5);
        topShape.quadraticCurveTo(3.5, -3.5, 3.5, -1.5);
        topShape.lineTo(3.5, 0);
        topShape.lineTo(-3.5, 0);

        const extrudeSettings = { depth: 0.25, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 };
        const topGeo = new THREE.ExtrudeGeometry(topShape, extrudeSettings);
        const top = new THREE.Mesh(topGeo, woodMat);
        top.rotation.x = -Math.PI / 2;
        top.position.set(0, 2.5, 0);
        group.add(top);

        // Felt surface
        const feltShape = new THREE.Shape();
        feltShape.moveTo(-3.2, 0);
        feltShape.lineTo(-3.2, -1.3);
        feltShape.quadraticCurveTo(-3.2, -3.2, 0, -3.2);
        feltShape.quadraticCurveTo(3.2, -3.2, 3.2, -1.3);
        feltShape.lineTo(3.2, 0);
        feltShape.lineTo(-3.2, 0);

        const feltExtSettings = { depth: 0.02, bevelEnabled: false };
        const feltGeo = new THREE.ExtrudeGeometry(feltShape, feltExtSettings);
        const felt = new THREE.Mesh(feltGeo, feltMat);
        felt.rotation.x = -Math.PI / 2;
        felt.position.set(0, 2.76, 0);
        group.add(felt);

        // Gold rim accent
        const rimGeo = new THREE.TorusGeometry(3.4, 0.06, 6, 32, Math.PI);
        const rim = new THREE.Mesh(rimGeo, goldTrim);
        rim.rotation.x = -Math.PI / 2;
        rim.rotation.z = Math.PI / 2;
        rim.position.set(0, 2.8, -1.8);
        group.add(rim);

        // Betting circles on felt (painted)
        for (let i = -2; i <= 2; i++) {
            const circle = new THREE.Mesh(
                new THREE.RingGeometry(0.28, 0.32, 24),
                mat(COLORS.goldBright, { emissive: COLORS.gold, emissiveIntensity: 0.3, rough: 0.5 })
            );
            circle.rotation.x = -Math.PI / 2;
            circle.position.set(i * 1.2, 2.78, -1.5);
            group.add(circle);
        }

        // Chip stacks on table
        addChipStack(group, -2, 2.78, 0.3, 0xc0392b, 5);
        addChipStack(group, 2, 2.78, 0.3, 0x2980b9, 3);
        addChipStack(group, 0.5, 2.78, -0.2, COLORS.gold, 7);

        // Card shoe
        group.add(box(0.8, 0.5, 0.5, mat(0x222222, { rough: 0.3 }), 3.2, 3.05, 0.3));

        // "BLACKJACK" label - glowing
        const labelGroup = new THREE.Group();
        // Simple glowing bar as indicator
        const labelBar = box(2.5, 0.08, 0.3, glowMat(COLORS.gold, 0.8), 0, 2.78, 0.2);
        labelGroup.add(labelBar);
        group.add(labelGroup);

        // Table hover highlight ring (invisible by default)
        const highlightGeo = new THREE.RingGeometry(4.2, 4.5, 32);
        const highlightMat = new THREE.MeshBasicMaterial({ color: COLORS.goldBright, transparent: true, opacity: 0, side: THREE.DoubleSide });
        const highlight = new THREE.Mesh(highlightGeo, highlightMat);
        highlight.rotation.x = -Math.PI / 2;
        highlight.position.y = 0.05;
        highlight.userData.isHighlight = true;
        group.add(highlight);

        group.userData.type = 'blackjack-table';
        group.userData.highlight = highlight;

        return group;
    }

    function addChipStack(parent, x, y, z, color, count) {
        for (let i = 0; i < count; i++) {
            const chip = cylinder(0.2, 0.2, 0.06, mat(color, { rough: 0.4, metal: 0.2 }), x, y + i * 0.06, z, 16);
            parent.add(chip);
            // White edge on chip
            const edge = new THREE.Mesh(
                new THREE.TorusGeometry(0.19, 0.015, 4, 16),
                mat(0xffffff, { rough: 0.5 })
            );
            edge.position.copy(chip.position);
            edge.rotation.x = Math.PI / 2;
            parent.add(edge);
        }
    }

    // ---------------------------------------------------------------
    // POKER TABLE
    // ---------------------------------------------------------------
    function buildPokerTable(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const woodMat = mat(COLORS.wood, { rough: 0.5 });
        const feltMat = mat(0x094d2a, { rough: 0.9 });

        // Oval table base
        group.add(cylinder(0.35, 0.4, 2.4, woodMat, 0, 1.2, 0));
        group.add(cylinder(1.0, 1.2, 0.25, woodMat, 0, 0.12, 0, 24));

        // Oval top
        const ovalGeo = new THREE.CylinderGeometry(3, 3, 0.3, 32);
        ovalGeo.scale(1.4, 1, 1);
        const top = new THREE.Mesh(ovalGeo, woodMat);
        top.position.y = 2.45;
        group.add(top);

        // Felt
        const feltGeo = new THREE.CylinderGeometry(2.7, 2.7, 0.03, 32);
        feltGeo.scale(1.4, 1, 1);
        const felt = new THREE.Mesh(feltGeo, feltMat);
        felt.position.y = 2.62;
        group.add(felt);

        // Card stacks
        addChipStack(group, -1.5, 2.64, 0, 0xc0392b, 4);
        addChipStack(group, 1.5, 2.64, 0, 0x1a5276, 6);
        addChipStack(group, 0, 2.64, 1, COLORS.gold, 3);

        // Scattered cards (flat boxes)
        for (let i = 0; i < 5; i++) {
            const card = box(0.45, 0.01, 0.65, mat(0xf8f6f0, { rough: 0.6 }),
                (Math.random() - 0.5) * 2, 2.64, (Math.random() - 0.5) * 2);
            card.rotation.y = Math.random() * Math.PI;
            group.add(card);
        }

        group.userData.type = 'poker-table';
        return group;
    }

    // ---------------------------------------------------------------
    // SLOT MACHINE
    // ---------------------------------------------------------------
    function buildSlotMachine(x, z, rotation = 0) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = rotation;

        const bodyMat = mat(0x2a2040, { rough: 0.4, metal: 0.3 });
        const chromeMat = mat(COLORS.chrome, { metal: 0.9, rough: 0.1 });
        const screenMat = mat(0x000000, { rough: 0.2 });

        // Main body
        group.add(box(1.2, 3.5, 1.0, bodyMat, 0, 1.75, 0));

        // Top arch
        group.add(box(1.4, 0.6, 1.1, bodyMat, 0, 3.7, 0));

        // Chrome trim
        group.add(box(1.25, 0.08, 1.05, chromeMat, 0, 3.0, 0));
        group.add(box(1.25, 0.08, 1.05, chromeMat, 0, 1.2, 0));

        // Screen area
        group.add(box(1.0, 0.8, 0.05, screenMat, 0, 2.5, 0.53));

        // Reel symbols (3 colored panels)
        const reelColors = [0xff1744, 0xffea00, 0x00e676];
        for (let i = -1; i <= 1; i++) {
            const reel = box(0.28, 0.55, 0.02,
                glowMat(reelColors[i + 1], 0.5 + Math.random() * 0.3),
                i * 0.32, 2.5, 0.555);
            group.add(reel);
        }

        // Lever arm
        group.add(cylinder(0.04, 0.04, 0.8, chromeMat, 0.75, 2.3, 0, 8));
        group.add(sphere(0.1, mat(0xff1744, { rough: 0.3 }), 0.75, 2.75, 0));

        // Coin tray
        group.add(box(1.0, 0.2, 0.5, chromeMat, 0, 0.4, 0.3));

        // Seat/stool in front
        const stool = buildStool(0, 0, 1.2);
        group.add(stool);

        // Top neon sign
        const neonColor = [COLORS.neonRed, COLORS.neonBlue, COLORS.neonPurple, COLORS.neonPink][Math.floor(Math.random() * 4)];
        const topGlow = box(1.2, 0.2, 0.3, glowMat(neonColor, 0.8), 0, 4.0, 0);
        group.add(topGlow);

        // Small light
        const sl = new THREE.PointLight(neonColor, 0.2, 4);
        sl.position.set(0, 4.1, 0.5);
        group.add(sl);

        group.userData.type = 'slot-machine';
        return group;
    }

    function buildStool(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const chromeMat = mat(COLORS.chrome, { metal: 0.8, rough: 0.15 });
        const seatMat = mat(0x8b0000, { rough: 0.7 });

        group.add(cylinder(0.08, 0.1, 1.6, chromeMat, 0, 0.8, 0, 8));
        group.add(cylinder(0.35, 0.35, 0.12, chromeMat, 0, 0.06, 0, 12));
        group.add(cylinder(0.3, 0.3, 0.15, seatMat, 0, 1.65, 0, 12));

        return group;
    }

    // ---------------------------------------------------------------
    // PERSON (Low-poly stylized character)
    // ---------------------------------------------------------------
    function buildPerson(skinColor, shirtColor, pantsColor, hairColor, seated = false, female = false) {
        const group = new THREE.Group();

        const skinMat = mat(skinColor, { rough: 0.8 });
        const shirtMat = mat(shirtColor, { rough: 0.7 });
        const pantsMat = mat(pantsColor ?? 0x1a1a2e, { rough: 0.6 });
        const hairMat = mat(hairColor ?? 0x1a1a1a, { rough: 0.9 });
        const shoeMat = mat(0x111111, { rough: 0.5 });

        const baseY = seated ? 1.5 : 0;

        // Legs
        if (seated) {
            // Seated: legs bent
            group.add(box(0.22, 0.7, 0.22, pantsMat, -0.18, 1.15, 0.2));
            group.add(box(0.22, 0.7, 0.22, pantsMat, 0.18, 1.15, 0.2));
            // Lower legs
            group.add(box(0.2, 0.7, 0.2, pantsMat, -0.18, 0.55, 0.55));
            group.add(box(0.2, 0.7, 0.2, pantsMat, 0.18, 0.55, 0.55));
            // Shoes
            group.add(box(0.22, 0.12, 0.3, shoeMat, -0.18, 0.15, 0.6));
            group.add(box(0.22, 0.12, 0.3, shoeMat, 0.18, 0.15, 0.6));
        } else {
            // Standing
            group.add(box(0.22, 1.0, 0.22, pantsMat, -0.18, 0.5, 0));
            group.add(box(0.22, 1.0, 0.22, pantsMat, 0.18, 0.5, 0));
            group.add(box(0.24, 0.12, 0.32, shoeMat, -0.18, 0.06, 0.05));
            group.add(box(0.24, 0.12, 0.32, shoeMat, 0.18, 0.06, 0.05));
        }

        // Torso
        const torsoW = female ? 0.55 : 0.65;
        const torsoH = female ? 0.75 : 0.85;
        group.add(box(torsoW, torsoH, 0.3, shirtMat, 0, baseY + 0.45, 0));

        // Arms
        const armMat = shirtMat;
        // Left arm - slightly forward if seated
        const armAngle = seated ? 0.3 : 0;
        const la = box(0.18, 0.7, 0.18, armMat, -(torsoW / 2 + 0.12), baseY + 0.35, armAngle * 0.5);
        la.rotation.x = -armAngle;
        group.add(la);
        const ra = box(0.18, 0.7, 0.18, armMat, (torsoW / 2 + 0.12), baseY + 0.35, armAngle * 0.5);
        ra.rotation.x = -armAngle;
        group.add(ra);

        // Hands
        group.add(sphere(0.08, skinMat, -(torsoW / 2 + 0.12), baseY + 0.0, seated ? 0.35 : 0));
        group.add(sphere(0.08, skinMat, (torsoW / 2 + 0.12), baseY + 0.0, seated ? 0.35 : 0));

        // Neck
        group.add(cylinder(0.1, 0.1, 0.15, skinMat, 0, baseY + 0.95, 0));

        // Head
        const headR = 0.28;
        group.add(sphere(headR, skinMat, 0, baseY + 1.25, 0));

        // Hair
        if (female) {
            // Long hair
            group.add(sphere(0.3, hairMat, 0, baseY + 1.35, -0.05));
            group.add(box(0.5, 0.5, 0.15, hairMat, 0, baseY + 1.1, -0.15));
        } else {
            // Short hair
            group.add(sphere(0.29, hairMat, 0, baseY + 1.33, -0.03));
        }

        // Eyes (simple dots)
        group.add(sphere(0.03, mat(0x111111), -0.1, baseY + 1.28, 0.22));
        group.add(sphere(0.03, mat(0x111111), 0.1, baseY + 1.28, 0.22));

        group.userData.type = 'person';
        group.userData.bobPhase = Math.random() * Math.PI * 2;

        return group;
    }

    // ---------------------------------------------------------------
    // NEON SIGNS
    // ---------------------------------------------------------------
    function buildNeonSign(text, color, x, y, z, rotY = 0) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotY;

        // Backing plate
        const backW = text.length * 0.6 + 1;
        group.add(box(backW, 1.2, 0.1, mat(0x0a0a0a, { rough: 0.8 }), 0, 0, -0.1));

        // Glow bar (represents the neon text)
        const glowBar = box(backW - 0.4, 0.5, 0.08, glowMat(color, 1.5), 0, 0, 0);
        group.add(glowBar);

        // Light
        const light = new THREE.PointLight(color, 0.8, 10);
        light.position.set(0, 0, 1);
        group.add(light);

        group.userData.neonGlow = glowBar;
        group.userData.neonLight = light;

        return group;
    }

    // ---------------------------------------------------------------
    // BAR AREA
    // ---------------------------------------------------------------
    function buildBar(x, z, rotY = 0) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = rotY;

        const woodMat = mat(COLORS.wood, { rough: 0.4, metal: 0.1 });
        const topMat = mat(0x1a1a1a, { rough: 0.1, metal: 0.3 }); // polished counter
        const chromeMat = mat(COLORS.chrome, { metal: 0.8, rough: 0.15 });

        // Bar counter
        group.add(box(6, 3.2, 1.0, woodMat, 0, 1.6, 0));
        group.add(box(6.2, 0.15, 1.2, topMat, 0, 3.25, 0));

        // Foot rail
        group.add(cylinder(0.04, 0.04, 6, chromeMat, 0, 0.4, 0.6, 8));
        const footRail = group.children[group.children.length - 1];
        footRail.rotation.z = Math.PI / 2;

        // Back shelf with bottles
        group.add(box(6, 4, 0.3, woodMat, 0, 2, -1.2));

        // Shelves
        for (let shelfY = 1.5; shelfY <= 3.5; shelfY += 1) {
            group.add(box(5.5, 0.08, 0.35, woodMat, 0, shelfY, -1.0));
        }

        // Bottles on shelves
        const bottleColors = [0x27ae60, 0xc8a45c, 0x8e44ad, 0xc0392b, 0x2980b9, 0xf39c12];
        for (let i = -2.5; i <= 2.5; i += 0.6) {
            const bottleColor = bottleColors[Math.floor(Math.random() * bottleColors.length)];
            const shelfY = 1.6 + Math.floor(Math.random() * 3) * 1.0;
            group.add(cylinder(0.08, 0.08, 0.5, mat(bottleColor, { rough: 0.2, metal: 0.1 }), i, shelfY + 0.25, -0.95, 6));
            group.add(cylinder(0.03, 0.05, 0.15, mat(bottleColor, { rough: 0.2 }), i, shelfY + 0.58, -0.95, 6));
        }

        // Mirror behind bar
        group.add(box(5, 2.5, 0.05, mat(0x334455, { rough: 0.05, metal: 0.8 }), 0, 2.5, -1.3));

        // Bar stools
        for (let i = -2; i <= 2; i += 1.3) {
            group.add(buildStool(i, 0, 1.0));
        }

        return group;
    }

    // ---------------------------------------------------------------
    // CHANDELIER
    // ---------------------------------------------------------------
    function buildChandelier(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const goldMat = mat(COLORS.gold, { metal: 0.8, rough: 0.15 });
        const crystalMat = mat(0xffffff, { rough: 0.05, metal: 0.1 });

        // Center rod
        group.add(cylinder(0.08, 0.08, 1.5, goldMat, 0, 0.75, 0));

        // Main ring
        const ringGeo = new THREE.TorusGeometry(1.5, 0.06, 8, 32);
        const ring = new THREE.Mesh(ringGeo, goldMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        // Inner ring
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 8, 24), goldMat);
        ring2.rotation.x = Math.PI / 2;
        ring2.position.y = 0.3;
        group.add(ring2);

        // Crystal drops
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const cx = Math.cos(angle) * 1.5;
            const cz = Math.sin(angle) * 1.5;
            // Crystal teardrop (small cone + sphere)
            group.add(cylinder(0, 0.04, 0.2, crystalMat, cx, -0.15, cz, 6));
            group.add(sphere(0.045, crystalMat, cx, -0.28, cz));
        }

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const cx = Math.cos(angle) * 0.8;
            const cz = Math.sin(angle) * 0.8;
            group.add(cylinder(0, 0.03, 0.15, crystalMat, cx, 0.18, cz, 6));
            group.add(sphere(0.035, crystalMat, cx, 0.08, cz));
        }

        // Light bulbs
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const bx = Math.cos(angle) * 1.5;
            const bz = Math.sin(angle) * 1.5;
            group.add(sphere(0.06, glowMat(0xffeedd, 1.5), bx, 0.05, bz));
        }

        // Central light
        const cl = new THREE.PointLight(0xffd090, 1.5, 20);
        cl.position.set(0, -0.3, 0);
        cl.castShadow = true;
        group.add(cl);

        group.userData.chandelier = true;

        return group;
    }

    // ---------------------------------------------------------------
    // ROULETTE TABLE (decoration)
    // ---------------------------------------------------------------
    function buildRouletteTable(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const woodMat = mat(COLORS.wood, { rough: 0.5 });
        const feltMat = mat(COLORS.felt, { rough: 0.9 });

        // Table base
        group.add(cylinder(0.3, 0.4, 2.4, woodMat, 0, 1.2, 0));
        group.add(box(4, 0.3, 2.5, woodMat, 0, 2.45, 0));
        group.add(box(3.7, 0.03, 2.2, feltMat, 0, 2.62, 0));

        // Roulette wheel
        group.add(cylinder(0.7, 0.7, 0.15, mat(COLORS.woodLight, { rough: 0.3 }), -1.2, 2.75, 0, 24));
        group.add(cylinder(0.6, 0.6, 0.08, mat(0x111111, { rough: 0.3 }), -1.2, 2.85, 0, 24));

        // Wheel segments (simplified)
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const segColor = i % 2 === 0 ? 0xc0392b : 0x111111;
            const seg = box(0.08, 0.05, 0.25, mat(segColor, { rough: 0.4 }),
                -1.2 + Math.cos(angle) * 0.35, 2.9, Math.sin(angle) * 0.35);
            seg.rotation.y = -angle;
            group.add(seg);
        }

        group.userData.type = 'roulette-table';
        return group;
    }

    // ---------------------------------------------------------------
    // BUILD THE COMPLETE CASINO SCENE
    // ---------------------------------------------------------------
    const animatedObjects = [];

    function buildCasino() {
        // Room
        scene.add(buildRoom());

        // === MAIN BLACKJACK TABLE (center front) ===
        blackjackTableMesh = buildBlackjackTable(blackjackTablePos.x, blackjackTablePos.z);
        scene.add(blackjackTableMesh);

        // Dealer behind BJ table
        const bjDealer = buildPerson(COLORS.skin1, 0x111111, 0x111111, 0x2a2a2a, false, false);
        bjDealer.position.set(0, 0, 2.5);
        bjDealer.rotation.y = Math.PI;
        scene.add(bjDealer);

        // Players at BJ table
        const bjP1 = buildPerson(COLORS.skin2, COLORS.shirt1, 0x1a1a2e, 0x1a1a1a, true, false);
        bjP1.position.set(-2, 0, 8);
        bjP1.rotation.y = Math.PI * 0.1;
        scene.add(bjP1);
        animatedObjects.push(bjP1);

        const bjP2 = buildPerson(COLORS.skin1, COLORS.dress1, 0x1a1a2e, 0x4a2a1a, true, true);
        bjP2.position.set(0, 0, 8.5);
        scene.add(bjP2);
        animatedObjects.push(bjP2);

        const bjP3 = buildPerson(COLORS.skin3, COLORS.shirt4, 0x2a2a3e, 0x111111, true, false);
        bjP3.position.set(2, 0, 8);
        bjP3.rotation.y = -Math.PI * 0.1;
        scene.add(bjP3);
        animatedObjects.push(bjP3);

        // Stools at BJ table
        for (let i = -2; i <= 2; i += 2) {
            const stool = buildStool(i, 0, 7.5 + Math.abs(i) * 0.15);
            scene.add(stool);
        }

        // === SECOND BLACKJACK TABLE (left) ===
        const bjTable2 = buildBlackjackTable(-8, 0);
        bjTable2.rotation.y = Math.PI * 0.3;
        scene.add(bjTable2);

        const bjP4 = buildPerson(COLORS.skin1, COLORS.shirt2, null, 0x3a2a1a, true, false);
        bjP4.position.set(-9.5, 0, 3);
        bjP4.rotation.y = Math.PI * 0.3;
        scene.add(bjP4);
        animatedObjects.push(bjP4);

        const bjP5 = buildPerson(COLORS.skin2, COLORS.dress2, null, 0x1a1a1a, true, true);
        bjP5.position.set(-7, 0, 3.5);
        bjP5.rotation.y = Math.PI * 0.2;
        scene.add(bjP5);
        animatedObjects.push(bjP5);

        // === POKER TABLES (back area) ===
        const pokerTable1 = buildPokerTable(-5, -8);
        scene.add(pokerTable1);

        const pokerTable2 = buildPokerTable(5, -8);
        scene.add(pokerTable2);

        // Poker players table 1
        for (let i = 0; i < 5; i++) {
            const angle = Math.PI * 0.3 + (i / 5) * Math.PI * 1.4;
            const px = -5 + Math.cos(angle) * 4;
            const pz = -8 + Math.sin(angle) * 4;
            const isFemale = Math.random() > 0.5;
            const skins = [COLORS.skin1, COLORS.skin2, COLORS.skin3];
            const shirts = [COLORS.shirt1, COLORS.shirt2, COLORS.shirt3, COLORS.shirt4, COLORS.shirt5];
            const p = buildPerson(
                skins[Math.floor(Math.random() * skins.length)],
                shirts[Math.floor(Math.random() * shirts.length)],
                null, null, true, isFemale
            );
            p.position.set(px, 0, pz);
            p.rotation.y = Math.atan2(-5 - px, -8 - pz);
            scene.add(p);
            animatedObjects.push(p);
        }

        // Poker players table 2
        for (let i = 0; i < 4; i++) {
            const angle = Math.PI * 0.2 + (i / 4) * Math.PI * 1.6;
            const px = 5 + Math.cos(angle) * 4;
            const pz = -8 + Math.sin(angle) * 4;
            const isFemale = Math.random() > 0.5;
            const skins = [COLORS.skin1, COLORS.skin2, COLORS.skin3];
            const shirts = [COLORS.shirt1, COLORS.shirt2, COLORS.shirt3, COLORS.shirt5];
            const p = buildPerson(
                skins[Math.floor(Math.random() * skins.length)],
                shirts[Math.floor(Math.random() * shirts.length)],
                null, null, true, isFemale
            );
            p.position.set(px, 0, pz);
            p.rotation.y = Math.atan2(5 - px, -8 - pz);
            scene.add(p);
            animatedObjects.push(p);
        }

        // === SLOT MACHINES (left wall) ===
        for (let i = 0; i < 6; i++) {
            const slotZ = -15 + i * 3.5;
            const slot = buildSlotMachine(-22, slotZ, Math.PI / 2);
            scene.add(slot);

            // Some have players
            if (i % 2 === 0) {
                const p = buildPerson(
                    [COLORS.skin1, COLORS.skin2, COLORS.skin3][i % 3],
                    [COLORS.shirt1, COLORS.shirt3, COLORS.shirt5][i % 3],
                    null, null, true, i % 3 === 1
                );
                p.position.set(-20.5, 0, slotZ);
                p.rotation.y = -Math.PI / 2;
                scene.add(p);
                animatedObjects.push(p);
            }
        }

        // === SLOT MACHINES (right wall) ===
        for (let i = 0; i < 6; i++) {
            const slotZ = -15 + i * 3.5;
            const slot = buildSlotMachine(22, slotZ, -Math.PI / 2);
            scene.add(slot);

            if (i % 2 === 1) {
                const p = buildPerson(
                    [COLORS.skin2, COLORS.skin1, COLORS.skin3][i % 3],
                    [COLORS.shirt2, COLORS.shirt4, COLORS.dress1][i % 3],
                    null, null, true, i % 2 === 0
                );
                p.position.set(20.5, 0, slotZ);
                p.rotation.y = Math.PI / 2;
                scene.add(p);
                animatedObjects.push(p);
            }
        }

        // === ROULETTE TABLE ===
        const rouletteTable = buildRouletteTable(10, 2);
        rouletteTable.rotation.y = -Math.PI * 0.2;
        scene.add(rouletteTable);

        // Roulette players
        for (let i = 0; i < 3; i++) {
            const angle = -Math.PI * 0.4 + i * 0.4;
            const p = buildPerson(
                [COLORS.skin1, COLORS.skin3, COLORS.skin2][i],
                [COLORS.shirt5, COLORS.shirt1, COLORS.dress2][i],
                null, null, true, i === 2
            );
            p.position.set(10 + Math.cos(angle) * 3.5, 0, 2 + Math.sin(angle) * 3.5);
            p.rotation.y = angle + Math.PI;
            scene.add(p);
            animatedObjects.push(p);
        }

        // === BAR (back wall) ===
        const bar = buildBar(0, -22, 0);
        scene.add(bar);

        // Bar patrons
        const barPatron1 = buildPerson(COLORS.skin1, COLORS.shirt2, null, 0x5a3422, true, false);
        barPatron1.position.set(-1.3, 0, -21);
        scene.add(barPatron1);
        animatedObjects.push(barPatron1);

        const barPatron2 = buildPerson(COLORS.skin2, COLORS.dress1, null, 0x1a1a1a, true, true);
        barPatron2.position.set(1.3, 0, -21);
        scene.add(barPatron2);
        animatedObjects.push(barPatron2);

        // Standing people walking around
        const walker1 = buildPerson(COLORS.skin1, COLORS.shirt3, null, 0x4a3a2a, false, false);
        walker1.position.set(6, 0, 12);
        walker1.rotation.y = -0.5;
        scene.add(walker1);
        animatedObjects.push(walker1);
        walker1.userData.walking = true;
        walker1.userData.walkPath = [
            new THREE.Vector3(6, 0, 12),
            new THREE.Vector3(15, 0, 8),
            new THREE.Vector3(15, 0, -5),
            new THREE.Vector3(6, 0, -5),
            new THREE.Vector3(6, 0, 12)
        ];
        walker1.userData.walkIdx = 0;
        walker1.userData.walkSpeed = 0.008;

        const walker2 = buildPerson(COLORS.skin3, COLORS.dress2, null, 0x111111, false, true);
        walker2.position.set(-6, 0, 14);
        walker2.rotation.y = 0.3;
        scene.add(walker2);
        animatedObjects.push(walker2);
        walker2.userData.walking = true;
        walker2.userData.walkPath = [
            new THREE.Vector3(-6, 0, 14),
            new THREE.Vector3(-15, 0, 10),
            new THREE.Vector3(-15, 0, -10),
            new THREE.Vector3(-6, 0, -10),
            new THREE.Vector3(-6, 0, 14)
        ];
        walker2.userData.walkIdx = 0;
        walker2.userData.walkSpeed = 0.006;

        // === CHANDELIERS ===
        scene.add(buildChandelier(0, 12.5, 0));
        scene.add(buildChandelier(-10, 12.5, -8));
        scene.add(buildChandelier(10, 12.5, -8));

        // === NEON SIGNS ===
        scene.add(buildNeonSign('BLACKJACK', COLORS.neonGreen, 0, 8, 4, 0));
        scene.add(buildNeonSign('POKER', COLORS.neonBlue, -5, 8, -5, 0));
        scene.add(buildNeonSign('SLOTS', COLORS.neonRed, -22, 8, 6, Math.PI / 2));
        scene.add(buildNeonSign('SLOTS', COLORS.neonPink, 22, 8, 6, -Math.PI / 2));
        scene.add(buildNeonSign('BAR', COLORS.neonPurple, 0, 8, -20, 0));
        scene.add(buildNeonSign('ROULETTE', COLORS.neonRed, 10, 8, 0, -Math.PI * 0.2));

        // === DECORATIVE PLANTS ===
        addPlant(-20, 0, 20);
        addPlant(20, 0, 20);
        addPlant(-20, 0, -20);
        addPlant(20, 0, -20);

        // === ROPE BARRIERS ===
        addRopeBarrier(-5, 0, 10, 5, 0, 10);
    }

    function addPlant(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // Pot
        group.add(cylinder(0.4, 0.3, 0.8, mat(0x3e2216, { rough: 0.6 }), 0, 0.4, 0, 8));
        group.add(cylinder(0.45, 0.45, 0.08, mat(0x3e2216, { rough: 0.6 }), 0, 0.82, 0, 8));

        // Plant leaves (sphere clusters)
        const leafMat = mat(0x1a5c2a, { rough: 0.8 });
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = 0.3 + Math.random() * 0.2;
            const h = 1.2 + Math.random() * 0.4;
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), leafMat);
            leaf.position.set(Math.cos(angle) * r, h, Math.sin(angle) * r);
            leaf.scale.set(1, 0.6, 1);
            group.add(leaf);
        }

        scene.add(group);
    }

    function addRopeBarrier(x1, y1, z1, x2, y2, z2) {
        const goldMat = mat(COLORS.gold, { metal: 0.7, rough: 0.2 });
        const ropeMat = mat(0x8b0000, { rough: 0.7 });

        // Posts
        scene.add(cylinder(0.08, 0.08, 1.0, goldMat, x1, 0.5, z1, 8));
        scene.add(sphere(0.1, goldMat, x1, 1.05, z1));
        scene.add(cylinder(0.08, 0.08, 1.0, goldMat, x2, 0.5, z2, 8));
        scene.add(sphere(0.1, goldMat, x2, 1.05, z2));

        // Rope (curved cylinder)
        const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6);
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, dist, 6), ropeMat);
        rope.position.set(midX, 0.85, midZ);
        rope.rotation.z = Math.PI / 2;
        rope.rotation.y = Math.atan2(z2 - z1, x2 - x1);
        scene.add(rope);
    }

    // ---------------------------------------------------------------
    // RAYCASTING (table click detection)
    // ---------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredTable = null;

    canvas.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        let foundBJ = false;
        for (const hit of intersects) {
            let obj = hit.object;
            // Walk up to find blackjack table group
            while (obj.parent && obj.parent !== scene) {
                obj = obj.parent;
            }
            if (obj.userData.type === 'blackjack-table' && obj === blackjackTableMesh) {
                foundBJ = true;
                if (hoveredTable !== obj) {
                    hoveredTable = obj;
                    canvas.style.cursor = 'pointer';
                }
                break;
            }
        }

        if (!foundBJ && hoveredTable) {
            hoveredTable = null;
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('click', () => {
        if (hoveredTable && hoveredTable === blackjackTableMesh && !transitioning) {
            startTransitionToGame();
        }
    });

    // Also handle the nav button
    document.querySelectorAll('.lobby-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset.target === 'blackjack' && !transitioning) {
                startTransitionToGame();
            }
        });
    });

    // ---------------------------------------------------------------
    // CAMERA ANIMATION & TRANSITION
    // ---------------------------------------------------------------
    let transitioning = false;
    let transitionProgress = 0;
    let transitionPhase = 'none'; // 'none' | 'zoom' | 'fade' | 'done'
    const cameraStart = new THREE.Vector3();
    const cameraEnd = new THREE.Vector3(0, 5, 9);
    const lookStart = new THREE.Vector3();
    const lookEnd = new THREE.Vector3(0, 2.8, 5);
    const lookCurrent = new THREE.Vector3(0, 3, 0);

    // Idle camera orbit
    let cameraAngle = 0;
    let cameraIdleRadius = 22;
    let cameraIdleHeight = 8;
    let cameraIdleSpeed = 0.08;

    function startTransitionToGame() {
        transitioning = true;
        transitionProgress = 0;
        transitionPhase = 'zoom';

        cameraStart.copy(camera.position);
        lookStart.copy(lookCurrent);

        // Hide lobby overlay
        const overlay = document.getElementById('lobby-overlay');
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    }

    function updateTransition(dt) {
        if (!transitioning) return;

        if (transitionPhase === 'zoom') {
            transitionProgress += dt * 0.45;
            const t = easeInOutCubic(Math.min(transitionProgress, 1));

            // Camera swoops toward the table
            camera.position.lerpVectors(cameraStart, cameraEnd, t);
            lookCurrent.lerpVectors(lookStart, lookEnd, t);
            camera.lookAt(lookCurrent);

            // At 70% start fading
            if (transitionProgress >= 0.7) {
                const fadeT = (transitionProgress - 0.7) / 0.3;
                const overlay = document.getElementById('transition-overlay');
                overlay.style.opacity = Math.min(fadeT, 1);
            }

            if (transitionProgress >= 1) {
                transitionPhase = 'fade';
                transitionProgress = 0;

                // Switch screens
                document.getElementById('lobby-screen').classList.add('hidden');
                document.getElementById('game-screen').classList.remove('hidden');
                document.getElementById('game-screen').style.opacity = '0';

                // Fade transition overlay out, game screen in
                setTimeout(() => {
                    document.getElementById('game-screen').style.transition = 'opacity 0.8s ease';
                    document.getElementById('game-screen').style.opacity = '1';
                    document.getElementById('transition-overlay').style.opacity = '0';
                }, 50);

                setTimeout(() => {
                    transitionPhase = 'done';
                    transitioning = false;
                    lobbyActive = false;
                    // Initialize game if needed
                    if (typeof window.initBlackjackGame === 'function') {
                        window.initBlackjackGame();
                    }
                }, 900);
            }
        }
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // ---------------------------------------------------------------
    // BACK TO LOBBY
    // ---------------------------------------------------------------
    window.backToLobby = function () {
        document.getElementById('game-screen').style.transition = 'opacity 0.5s ease';
        document.getElementById('game-screen').style.opacity = '0';

        setTimeout(() => {
            document.getElementById('game-screen').classList.add('hidden');
            document.getElementById('game-screen').style.opacity = '1';
            document.getElementById('lobby-screen').classList.remove('hidden');
            document.getElementById('transition-overlay').style.opacity = '0';

            const overlay = document.getElementById('lobby-overlay');
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';

            lobbyActive = true;
            transitioning = false;
            transitionPhase = 'none';
        }, 500);
    };

    // ---------------------------------------------------------------
    // ANIMATION LOOP
    // ---------------------------------------------------------------
    let lobbyActive = true;
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        if (!lobbyActive && !transitioning) return;

        const dt = Math.min(clock.getDelta(), 0.05);
        const time = clock.elapsedTime;

        // Idle camera orbit
        if (!transitioning) {
            cameraAngle += cameraIdleSpeed * dt;
            camera.position.x = Math.sin(cameraAngle) * cameraIdleRadius;
            camera.position.z = Math.cos(cameraAngle) * cameraIdleRadius;
            camera.position.y = cameraIdleHeight + Math.sin(time * 0.3) * 0.5;
            lookCurrent.set(0, 3, 0);
            camera.lookAt(lookCurrent);
        }

        // Table highlight
        if (blackjackTableMesh && blackjackTableMesh.userData.highlight) {
            const hl = blackjackTableMesh.userData.highlight;
            const targetOpacity = hoveredTable === blackjackTableMesh ? 0.6 : 0;
            hl.material.opacity += (targetOpacity - hl.material.opacity) * 0.1;
        }

        // Animate people (subtle idle movement)
        for (const obj of animatedObjects) {
            if (obj.userData.walking) {
                // Walking characters
                const path = obj.userData.walkPath;
                const idx = obj.userData.walkIdx;
                const target = path[(idx + 1) % path.length];
                const current = obj.position;
                const dir = new THREE.Vector3().subVectors(target, current);
                const dist = dir.length();

                if (dist < 0.3) {
                    obj.userData.walkIdx = (idx + 1) % path.length;
                } else {
                    dir.normalize().multiplyScalar(obj.userData.walkSpeed * 60 * dt);
                    obj.position.add(dir);
                    obj.rotation.y = Math.atan2(dir.x, dir.z);
                }

                // Walking bob
                obj.position.y = Math.abs(Math.sin(time * 4 + obj.userData.bobPhase)) * 0.05;
            } else {
                // Seated idle - subtle sway
                const phase = obj.userData.bobPhase;
                obj.rotation.z = Math.sin(time * 0.5 + phase) * 0.02;
                obj.rotation.x = Math.sin(time * 0.7 + phase) * 0.01;
            }
        }

        // Neon sign pulsing
        scene.traverse((child) => {
            if (child.userData.neonGlow) {
                const glow = child.userData.neonGlow;
                const intensity = 1.2 + Math.sin(time * 2 + child.position.x) * 0.3;
                glow.material.emissiveIntensity = intensity;
            }
        });

        // Transition
        updateTransition(dt);

        renderer.render(scene, camera);
    }

    // ---------------------------------------------------------------
    // RESIZE
    // ---------------------------------------------------------------
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---------------------------------------------------------------
    // INIT
    // ---------------------------------------------------------------
    buildCasino();
    animate();

})();

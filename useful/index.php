<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>大宇之形 方寸之间</title>

    <meta property="og:title" content="大宇之形 方寸之间" />
    <meta property="og:description" content="见证、记录、储存人类点点滴的灵性。" />
    <meta property="og:type" content="website" />
    <?php
        // Attempt to construct the base URL.
        // This assumes navigation.php is in the same directory or accessible via include path.
        // And that $base_url is defined in navigation.php
        // If navigation.php is included later, this might not work as expected for $base_url.
        // A more robust solution would be to define $base_url globally or pass it.
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
        $host = $_SERVER['HTTP_HOST'];
        $current_page_url = $protocol . $host . $_SERVER['REQUEST_URI'];
        // If you have a predefined base URL, use that. For example, from navigation.php if it were included earlier.
        // For now, we use the dynamically constructed URL of the current page.
    ?>
    <meta property="og:url" content="<?php echo htmlspecialchars($current_page_url); ?>" />
    <meta property="og:image" content="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1200'%20height='630'%20viewBox='0%200%201200%20630'%3E%3Cdefs%3E%3CradialGradient%20id='g1'%20cx='0.5'%20cy='0.5'%20r='0.5'%3E%3Cstop%20offset='0'%20stop-color='%23b464ff'%20stop-opacity='0.8'/%3E%3Cstop%20offset='0.5'%20stop-color='%236478ff'%20stop-opacity='0.4'/%3E%3Cstop%20offset='1'%20stop-color='%23323264'%20stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient%20id='g2'%20cx='0.5'%20cy='0.5'%20r='0.5'%3E%3Cstop%20offset='0'%20stop-color='%23ff96c8'%20stop-opacity='0.7'/%3E%3Cstop%20offset='0.6'%20stop-color='%23b464ff'%20stop-opacity='0.3'/%3E%3Cstop%20offset='1'%20stop-color='%23503296'%20stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect%20width='1200'%20height='630'%20fill='%23000010'/%3E%3Ccircle%20cx='400'%20cy='250'%20r='250'%20fill='url(%23g1)'/%3E%3Ccircle%20cx='750'%20cy='350'%20r='300'%20fill='url(%23g2)'%20opacity='0.8'/%3E%3Ccircle%20cx='200'%20cy='150'%20r='3'%20fill='%23fff'/%3E%3Ccircle%20cx='500'%20cy='400'%20r='2'%20fill='%23fff'%20opacity='0.8'/%3E%3Ccircle%20cx='900'%20cy='200'%20r='4'%20fill='%23fff'/%3E%3Ccircle%20cx='1000'%20cy='500'%20r='2'%20fill='%23fff'%20opacity='0.7'/%3E%3Ccircle%20cx='150'%20cy='450'%20r='3'%20fill='%23fff'%20opacity='0.9'/%3E%3Ctext%20x='600'%20y='335'%20font-family='Noto%20Sans%20SC,%20sans-serif'%20font-size='70'%20fill='%23E0E8F0'%20text-anchor='middle'%3E大宇之形%3C/text%3E%3C/svg%3E" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="大宇之形 方寸之间">
    <meta name="twitter:description" content="见证、记录、储存人类点点滴的灵性。" />
    <meta name="twitter:image" content="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1200'%20height='630'%20viewBox='0%200%201200%20630'%3E%3Cdefs%3E%3CradialGradient%20id='g1'%20cx='0.5'%20cy='0.5'%20r='0.5'%3E%3Cstop%20offset='0'%20stop-color='%23b464ff'%20stop-opacity='0.8'/%3E%3Cstop%20offset='0.5'%20stop-color='%236478ff'%20stop-opacity='0.4'/%3E%3Cstop%20offset='1'%20stop-color='%23323264'%20stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient%20id='g2'%20cx='0.5'%20cy='0.5'%20r='0.5'%3E%3Cstop%20offset='0'%20stop-color='%23ff96c8'%20stop-opacity='0.7'/%3E%3Cstop%20offset='0.6'%20stop-color='%23b464ff'%20stop-opacity='0.3'/%3E%3Cstop%20offset='1'%20stop-color='%23503296'%20stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect%20width='1200'%20height='630'%20fill='%23000010'/%3E%3Ccircle%20cx='400'%20cy='250'%20r='250'%20fill='url(%23g1)'/%3E%3Ccircle%20cx='750'%20cy='350'%20r='300'%20fill='url(%23g2)'%20opacity='0.8'/%3E%3Ccircle%20cx='200'%20cy='150'%20r='3'%20fill='%23fff'/%3E%3Ccircle%20cx='500'%20cy='400'%20r='2'%20fill='%23fff'%20opacity='0.8'/%3E%3Ccircle%20cx='900'%20cy='200'%20r='4'%20fill='%23fff'/%3E%3Ccircle%20cx='1000'%20cy='500'%20r='2'%20fill='%23fff'%20opacity='0.7'/%3E%3Ccircle%20cx='150'%20cy='450'%20r='3'%20fill='%23fff'%20opacity='0.9'/%3E%3Ctext%20x='600'%20y='335'%20font-family='Noto%20Sans%20SC,%20sans-serif'%20font-size='70'%20fill='%23E0E8F0'%20text-anchor='middle'%3E大宇之形%3C/text%3E%3C/svg%3E">


    <style>
        /* 全局样式和字体导入 */
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css');

        :root {
            --star-bg: #000002; /* 更极致的深空背景色 */
            --tile-bg: rgba(20, 30, 60, 0.8);
            --tile-hover-bg: rgba(35, 50, 85, 0.95);
            --text-color: #e0e8f0;
            --header-color: #f0f8ff;
            --border-color: rgba(255, 255, 255, 0.1);
        }

        body {
            font-family: 'Noto Sans SC', sans-serif;
            margin: 0;
            padding: 0;
            background-color: var(--star-bg);
            color: var(--text-color);
            line-height: 1.7;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
            box-sizing: border-box;
            overflow-x: hidden; /* 防止横向滚动条 */
        }

        /* Canvas 星空背景样式 */
        #starfield {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1; /* 置于最底层 */
            pointer-events: none; /* 确保不干扰页面交互 */
        }

        /* 页面容器 */
        .container {
            background-color: rgba(10, 15, 30, 0.75);
            padding: 35px 45px;
            border-radius: 20px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4), 0 0 10px rgba(100,100,255,0.1);
            width: 95%;
            max-width: 1200px;
            text-align: center;
            margin-top: 20px;
            border: 1px solid var(--border-color);
            position: relative; /* 确保内容在 Canvas 之上 */
            z-index: 1;
        }

        /* 头部标题 */
        header h1 {
            color: var(--header-color);
            font-size: 3.2em;
            margin-bottom: 10px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-shadow: 0 0 10px rgba(173, 216, 230, 0.8), 0 0 20px rgba(173, 216, 230, 0.6), 0 0 30px rgba(100,180,255,0.4);
        }
        header p {
            color: #b0c4de;
            font-size: 1.2em;
            margin-bottom: 40px;
        }

        /* 导航区域 */
        #auto-navigation {
            margin-top: 25px;
            text-align: left;
        }

        #auto-navigation h2 {
            color: #d1d5db;
            font-size: 2em;
            margin-bottom: 30px;
            padding-bottom: 12px;
            border-bottom: 3px solid #5895f1;
            text-align: center;
        }

        /* 导航列表 - 磁贴布局 */
        #auto-navigation ul {
            list-style-type: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 25px;
        }

        /* 导航列表项 - 磁贴样式 */
        #auto-navigation ul li {
            background-color: var(--tile-bg);
            border-radius: 15px;
            transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
            overflow: visible;
            border: 1px solid rgba(255, 255, 255, 0.08);
            min-height: 140px;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        #auto-navigation ul li:hover {
            transform: translateY(-10px) scale(1.05);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(135, 206, 250, 0.4);
            background-color: var(--tile-hover-bg);
        }

        /* 导航链接 */
        #auto-navigation ul li a {
            text-decoration: none;
            color: #cbd5e1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 20px 15px 15px 15px;
            font-size: 1.0em;
            font-weight: 500;
            text-align: center;
            word-break: break-word;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }

        /* 图标和日期区域 */
        .tile-icon-area {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 10px;
        }

        .link-icon {
            font-size: 2.5em;
            color: #93c5fd;
            margin-bottom: 5px;
            transition: color 0.3s ease, transform 0.3s ease;
        }
         #auto-navigation ul li a:hover .link-icon {
            color: #d0eaff;
            transform: scale(1.1);
        }

        .tile-date {
            font-size: 0.7em;
            font-weight: bold;
            color: #f0f8ff;
            background-color: rgba(60, 120, 180, 0.8);
            padding: 3px 7px;
            border-radius: 5px;
            position: absolute;
            top: -10px;
            right: -8px;
            line-height: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.25);
            white-space: nowrap;
            z-index: 2;
        }

        .link-text {
            font-size: 0.95em;
            line-height: 1.3;
            max-height: 2.6em;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            margin-top: auto;
        }


        /* 当列表为空时的提示 */
        #auto-navigation ul li.no-files {
            grid-column: 1 / -1;
            text-align: center;
            padding: 25px;
            color: #9ca3af;
            background-color: rgba(55, 65, 81, 0.5);
            border: 1px dashed var(--border-color);
            box-shadow: none;
            min-height: auto;
        }
        #auto-navigation ul li.no-files:hover {
            transform: none;
            box-shadow: none;
            background-color: rgba(55, 65, 81, 0.5);
        }


        /* 页脚 */
        footer {
            margin-top: 50px;
            padding: 25px;
            color: rgba(229, 231, 235, 0.6);
            font-size: 0.9em;
            width: 100%;
            text-align: center;
            z-index: 1;
        }

        /* 响应式调整 */
        @media (max-width: 992px) {
             #auto-navigation ul {
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            }
        }
        @media (max-width: 768px) {
            .container {
                padding: 25px 30px;
            }
            header h1 {
                font-size: 2.6em;
            }
            #auto-navigation h2 {
                font-size: 1.8em;
            }
            #auto-navigation ul {
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                gap: 20px;
            }
             #auto-navigation ul li {
                min-height: 130px;
            }
            .link-icon {
                font-size: 2.2em;
            }
            .tile-date {
                font-size: 0.65em;
                padding: 2px 5px;
                top: -7px;
                right: -6px;
            }
        }

        @media (max-width: 480px) {
            header h1 {
                font-size: 2.1em;
            }
            #auto-navigation ul {
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 15px;
            }
            #auto-navigation ul li {
                min-height: 120px;
                border-radius: 12px;
            }
             #auto-navigation ul li a {
                font-size: 0.85em;
                padding: 15px 10px 10px 10px;
            }
            .link-icon {
                font-size: 2em;
            }
             .tile-date {
                font-size: 0.6em;
                padding: 2px 4px;
                top: -6px;
                right: -5px;
            }
            .link-text {
                font-size: 0.9em;
            }
        }
    </style>
</head>
<body>
    <canvas id="starfield"></canvas>

    <div class="container">
        <header>
            <h1>学习与探索之旅</h1>
            <p>大宇之形，方寸之间</p>
        </header>

        <nav id="auto-navigation">
            <h2>一个灵性收集器</h2>
            <?php
                // It's generally better to define $base_url in a central config file
                // or at the top of this script if it's specific to index.php.
                // For now, we assume navigation.php might define it, or we use a fallback.
                if (file_exists('navigation.php')) {
                    include 'navigation.php'; // If $base_url is defined in navigation.php, it would be available after this include.
                } else {
                    echo "<ul><li class='no-files'>导航文件 (navigation.php) 未找到。请检查文件路径。</li></ul>";
                }
            ?>
        </nav>
    </div>

    <footer>
        <p>&copy; <?php echo date("Y"); ?> ・ 所有权归skywalker</p>
    </footer>

    <script>
        const canvas = document.getElementById('starfield');
        const ctx = canvas.getContext('2d');

        let stars = [];
        const numStars = 150; // 星星数量 (略微减少以优化碰撞计算)
        const connectionDistance = 40; // 星星之间连接线的最大距离 (大幅减少)
        const mouseInteractionRadius = 150; // 鼠标交互半径
        let mouse = { x: null, y: null };

        // 设置Canvas尺寸
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas(); // 初始化尺寸

        // 辅助 Vector 类
        class Vector {
            constructor(x, y) {
                this.x = x || 0;
                this.y = y || 0;
            }
            add(v) { this.x += v.x; this.y += v.y; return this; }
            subtract(v) { this.x -= v.x; this.y -= v.y; return this; }
            multiply(s) { this.x *= s; this.y *= s; return this; }
            divide(s) { if (s !== 0) { this.x /= s; this.y /= s; } return this; }
            magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y); }
            normalize() { let m = this.magnitude(); if (m > 0) { this.divide(m); } return this; }
            limit(max) { if (this.magnitude() > max) { this.normalize(); this.multiply(max); } return this; }
            setMagnitude(len) { this.normalize(); this.multiply(len); return this; }
            dot(v) { return this.x * v.x + this.y * v.y; }
            clone() { return new Vector(this.x, this.y); }
        }

        function distance(x1, y1, x2, y2) {
            const dx = x1 - x2;
            const dy = y1 - y2;
            return Math.sqrt(dx * dx + dy * dy);
        }

        // 星星类
        class Star {
            constructor() {
                this.pos = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);

                // 调整星星大小: "小一号"
                this.baseRadius = Math.random() * 1.5 + 0.5;
                this.radius = this.baseRadius * (1.5 + Math.random() * 1.5);

                this.color = `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.3})`; // 透明度降低，显得更柔和

                // 质量与半径的平方成正比 (面积)
                this.mass = Math.PI * this.radius * this.radius;
                if (this.mass === 0) this.mass = 0.001; // 避免除以零

                this.vel = new Vector((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8); // 初始速度略微提高

                this.maxSpeed = 0.6 + Math.random() * 0.4; // 最大速度
                this.maxForce = 0.02 + Math.random() * 0.01; // 最大作用力
                this.wanderAngle = Math.random() * Math.PI * 2;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
            }

            applyBoids(starsArray) {
                 // Boids 行为 (简化版，主要用于非碰撞时的移动趋势)
                let separation = this.separate(starsArray);
                let alignment = this.align(starsArray);
                let cohesion = this.cohesion(starsArray);
                let wander = this.wander();
                let mouseAvoid = this.avoidMouse();

                separation = separation.multiply(2.0); // 分隔力权重，防止聚集过密
                alignment = alignment.multiply(0.3);   // 减弱对齐
                cohesion = cohesion.multiply(0.2);    // 减弱凝聚
                wander = wander.multiply(0.8);       // 增强漫游
                mouseAvoid = mouseAvoid.multiply(2.0);

                this.applyForce(separation);
                this.applyForce(alignment);
                this.applyForce(cohesion);
                this.applyForce(wander);
                this.applyForce(mouseAvoid);
            }

            update() {
                // 更新速度和位置
                this.pos.add(this.vel);

                // 边界检测 (反弹)
                if (this.pos.x + this.radius > canvas.width) {
                    this.pos.x = canvas.width - this.radius;
                    this.vel.x *= -0.8; // 能量损失
                } else if (this.pos.x - this.radius < 0) {
                    this.pos.x = this.radius;
                    this.vel.x *= -0.8;
                }
                if (this.pos.y + this.radius > canvas.height) {
                    this.pos.y = canvas.height - this.radius;
                    this.vel.y *= -0.8;
                } else if (this.pos.y - this.radius < 0) {
                    this.pos.y = this.radius;
                    this.vel.y *= -0.8;
                }
                this.draw();
            }

            applyForce(force) {
                // 力 = 质量 * 加速度 => 加速度 = 力 / 质量
                let acc = force.clone().divide(this.mass);
                this.vel.add(acc);
                this.vel.limit(this.maxSpeed);
            }

            // Boids - 分隔
            separate(others) {
                let desiredSeparation = this.radius * 2.0;
                let steer = new Vector(0, 0);
                let count = 0;
                for (let other of others) {
                    if (other === this) continue;
                    let d = distance(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
                    if (d > 0 && d < desiredSeparation && d < this.radius + other.radius + 5) {
                        let diff = this.pos.clone().subtract(other.pos);
                        diff.normalize();
                        diff.divide(d * 0.5);
                        steer.add(diff);
                        count++;
                    }
                }
                if (count > 0) steer.divide(count);
                if (steer.magnitude() > 0) {
                    steer.setMagnitude(this.maxSpeed);
                    steer.subtract(this.vel);
                    steer.limit(this.maxForce * 0.5);
                }
                return steer;
            }

            align(others) { return new Vector(); }
            cohesion(others) { return new Vector(); }

            wander() {
                let wanderRadius = 8;
                let wanderDistance = 15;
                let wanderChange = 0.2;

                this.wanderAngle += (Math.random() * wanderChange) - (wanderChange * 0.5);

                let circlePos = this.vel.clone();
                circlePos.normalize();
                circlePos.multiply(wanderDistance);
                circlePos.add(this.pos);

                let h = Math.atan2(this.vel.y, this.vel.x);
                let wanderX = wanderRadius * Math.cos(this.wanderAngle + h);
                let wanderY = wanderRadius * Math.sin(this.wanderAngle + h);

                let target = circlePos.add(new Vector(wanderX, wanderY));
                return this.seek(target);
            }

            seek(target) {
                let desired = target.clone().subtract(this.pos);
                desired.setMagnitude(this.maxSpeed);
                let steer = desired.subtract(this.vel);
                steer.limit(this.maxForce);
                return steer;
            }

            avoidMouse() {
                if (mouse.x === null || mouse.y === null) return new Vector(0,0);
                let d = distance(this.pos.x, this.pos.y, mouse.x, mouse.y);
                if (d < mouseInteractionRadius) {
                    let desired = this.pos.clone().subtract(new Vector(mouse.x, mouse.y));
                    desired.setMagnitude(this.maxSpeed);
                    let steer = desired.subtract(this.vel);
                    steer.limit(this.maxForce * 1.5);
                    return steer;
                }
                return new Vector(0,0);
            }
        }

        // 碰撞解决函数
        function resolveCollision(s1, s2) {
            const xVelDiff = s1.vel.x - s2.vel.x;
            const yVelDiff = s1.vel.y - s2.vel.y;

            const xDist = s2.pos.x - s1.pos.x;
            const yDist = s2.pos.y - s1.pos.y;

            if (xVelDiff * xDist + yVelDiff * yDist >= 0) {
                const angle = -Math.atan2(yDist, xDist);

                const m1 = s1.mass;
                const m2 = s2.mass;

                const u1 = rotate(s1.vel, angle);
                const u2 = rotate(s2.vel, angle);

                const v1 = new Vector(u1.x * (m1 - m2) / (m1 + m2) + u2.x * 2 * m2 / (m1 + m2), u1.y);
                const v2 = new Vector(u2.x * (m2 - m1) / (m1 + m2) + u1.x * 2 * m1 / (m1 + m2), u2.y);

                const vFinal1 = rotate(v1, -angle);
                const vFinal2 = rotate(v2, -angle);

                s1.vel.x = vFinal1.x;
                s1.vel.y = vFinal1.y;
                s2.vel.x = vFinal2.x;
                s2.vel.y = vFinal2.y;

                const overlap = (s1.radius + s2.radius) - distance(s1.pos.x, s1.pos.y, s2.pos.x, s2.pos.y);
                if (overlap > 0) {
                    const correctionNormal = s1.pos.clone().subtract(s2.pos).normalize();
                    const correction1 = correctionNormal.clone().multiply(overlap * (s2.mass / (s1.mass + s2.mass)));
                    const correction2 = correctionNormal.clone().multiply(-overlap * (s1.mass / (s1.mass + s2.mass)));
                    s1.pos.add(correction1);
                    s2.pos.add(correction2);
                }
            }
        }

        function rotate(velocity, angle) {
            return new Vector(
                velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
                velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
            );
        }

        // 鼠标移动事件
        window.addEventListener('mousemove', (event) => {
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        });
        window.addEventListener('mouseout', () => {
            mouse.x = null;
            mouse.y = null;
        });

        // 初始化星星
        function initStars() {
            stars = [];
            for (let i = 0; i < numStars; i++) {
                stars.push(new Star());
            }
        }
        initStars();

        // 动画循环
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            stars.forEach(star => {
                star.applyBoids(stars);
            });

            for (let i = 0; i < stars.length; i++) {
                for (let j = i + 1; j < stars.length; j++) {
                    const s1 = stars[i];
                    const s2 = stars[j];
                    const dist = distance(s1.pos.x, s1.pos.y, s2.pos.x, s2.pos.y);
                    if (dist < s1.radius + s2.radius) {
                        resolveCollision(s1, s2);
                    }
                }
            }

            if (connectionDistance > 0) {
                for (let i = 0; i < stars.length; i++) {
                    for (let j = i + 1; j < stars.length; j++) {
                        if (Math.random() < 0.02) {
                            const d = distance(stars[i].pos.x, stars[i].pos.y, stars[j].pos.x, stars[j].pos.y);
                            if (d < connectionDistance) {
                                ctx.beginPath();
                                ctx.moveTo(stars[i].pos.x, stars[i].pos.y);
                                ctx.lineTo(stars[j].pos.x, stars[j].pos.y);
                                ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 - (d / connectionDistance) * 0.4})`;
                                ctx.lineWidth = 0.3;
                                ctx.stroke();
                            }
                        }
                    }
                }
            }

            stars.forEach(star => {
                star.update();
            });

            requestAnimationFrame(animate);
        }
        animate();

        window.addEventListener('resize', () => {
            resizeCanvas();
            initStars();
        });

    </script>
</body>
</html>

pipeline {
    agent any
    tools {
        nodejs 'NodeJS'
        //เพิ่ม SonarQube Scanner Tool definition ที่นี่
        'hudson.plugins.sonar.SonarRunnerInstallation' 'SonarQubeScanner'
    }
    environment {
        SONAR_PROJECT_KEY = 'kan-product-admin'
    }
    stages {
        stage('GitHub') {
            steps {
                git branch: 'main', credentialsId: 'jenkins-git-dind', url: 'https://github.com/MysteryProduct/kan-product-admin.git'
            }
        }
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        stage('Unit Test') {
            steps {
                sh 'npm run build'
            }
        }
        stage('SonarQube Analysis') {
            steps {
                script {
                    // 1. ใช้ 'script' block เพื่อเรียกใช้ 'tool' step แบบ Scripted Pipeline
                    // ชื่อ 'SonarQubeScanner' ต้องตรงกับชื่อใน Manage Jenkins -> Global Tool Config
                    scannerHome = tool 'SonarQubeScanner' 
                }
                withCredentials([string(credentialsId: 'kan-product-admin', variable: 'SONAR_TOKEN')]) {
                    withSonarQubeEnv('SonarQube') {
                        // 2. ใช้ Environment Variable ที่ได้จาก 'script' block
                        sh """
                        # ใช้ตัวแปร ${scannerHome} เพื่อระบุ Path ที่ถูกต้อง
                        ${scannerHome}/bin/sonar-scanner \\
                        -Dsonar.projectKey=\${SONAR_PROJECT_KEY} \\
                        -Dsonar.sources=. \\
                        -Dsonar.host.url=http://localhost:9000 \\
                        -Dsonar.login=\${SONAR_TOKEN}
                        """
                    }
                }
            }
        }
    }
}
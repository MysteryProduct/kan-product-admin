pipeline {
    agent any
    tools {
        nodejs 'NodeJS'
        //เพิ่ม SonarQube Scanner Tool definition ที่นี่
        tool name: 'SonarQubeScanner', type: 'hudson.plugins.sonar.SonarRunnerInstallation' 
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
                //ใช้ชื่อ Credentials ID สำหรับ Token ที่ถูกต้อง
                withCredentials([string(credentialsId: 'kan-product-admin', variable: 'SONAR_TOKEN')]) {
                    //ชื่อ 'SonarQube' ต้องตรงกับชื่อ Configuration ใน Manage Jenkins -> Configure System
                    withSonarQubeEnv('SonarQube') {
                        sh """
                        # 5. เรียกใช้ 'sonar-scanner' โดยตรง ไม่ต้องระบุ Path แบบ Hardcode
                        # Jenkins จะจัดการเพิ่ม Path จาก 'tool' ด้านบนให้เอง
                        sonar-scanner \\
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
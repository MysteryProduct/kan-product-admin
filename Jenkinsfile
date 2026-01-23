pipeline{
    agent any
    tools {
        nodejs 'NodeJS'
    }
    environment {
        SONAR_PROJECT_KEY = 'kan-product-admin'
        SONAR_TOKEN = tool 'SonarQube Scanner'
    }
    stages {
        stage('GitHub') {
            steps {
                git branch: 'main', credentialsId: 'jenkins-git-dind', url: 'https://github.com/MysteryProduct/kan-product-admin.git'
            }
        }
        stage('Install Dependencies') { // เพิ่ม Stage นี้
            steps {
                sh 'npm install' // ติดตั้ง dependencies ทั้งหมด
            }
        }
        stage('Unit Test') {
            steps {
                // sh 'npm install' // หรือจะเพิ่มที่นี่ก็ได้
                sh 'npm run build' // ตอนนี้คำสั่ง 'next' จะทำงานได้แล้ว
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withCredentials([string(credentialsId: 'kan-product-admin', variable: 'SONAR_TOKEN')]) {
                // some block
                    withSonarQubeEnv('SonarQube') {
                        sh """
                        \${SONAR_SCANNER_HOME}/bin/sonar-scanner \\
                        -Dsonar.projectKey=\${SONAR_PROJECT_KEY} \\
                        -Dsonar.sources=. \\
                        -Dsonar.host.url=http://192.168.1.128:9000 \\
                        -Dsonar.login=\${SONAR_TOKEN}
                        """
                    }
                }
            }
        }
    }
}
pipeline{
    agent any
    tools {
        nodejs 'NodeJS'
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
    }
}
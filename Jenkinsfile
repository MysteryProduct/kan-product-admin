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
        // stage('Unit Test') {
        //     steps {
                
        //     }
        // }
    }
}